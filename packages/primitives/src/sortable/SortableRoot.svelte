<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import type { DropVerdict, Point, Rect } from '@texuli/drag';
import {
  type AutoScroller,
  type AutoScrollOptions,
  createAutoScroller,
} from '@texuli/drag/auto-scroll';
import type { CollisionStrategy } from '@texuli/drag/collision';
import { capturePointer, createPointerTracker, type PointerTracker } from '@texuli/drag/gesture';
import {
  type DragMessagesOverrides,
  formatDragMessage,
  formatRefusal,
  resolveDragMessages,
} from '@texuli/drag/messages';
import { applyModifiers, type Modifier } from '@texuli/drag/modifiers';
import {
  applyMove,
  createSortable,
  createSortableSnapshot,
  type SortableContainer,
  type SortableEvent,
  type SortableMode,
  type SortableModel,
  type SortableMove,
  type SortableSnapshot,
  type SortableState,
} from '@texuli/drag/sortable';
import { type Snippet, tick, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { type DropIndicator, sortableContext } from './context.ts';
import {
  directionOf,
  measureContainers,
  playFlip,
  rectOf,
  reducedMotion,
  scrollTargets,
  snapshotRects,
} from './dom.ts';
import { sortableIntent } from './keys.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Every list, in order. Bind it: drops update it unless `onMove` returns false. */
  containers: readonly SortableContainer[];
  /** Multi-drag: the selected item ids; dragging a selected item moves them all. */
  selection?: readonly string[];
  mode?: SortableMode;
  /** True for items that never drag. */
  filter?: (itemId: string) => boolean;
  /** Locked items, on top of each container's `locked`. */
  isLocked?: (itemId: string) => boolean;
  canDrop?: (move: SortableMove, model: SortableModel) => DropVerdict;
  maxDepth?: number;
  cloneId?: (itemId: string, taken: (id: string) => boolean) => string;
  /** Keyboard moves past a list's edge continue in the neighbouring list. */
  crossContainers?: boolean;
  /** Pointer modifiers (axis lock, bounds, snap) applied to the drag translation. */
  modifiers?: readonly Modifier[];
  /** Picks the list under the pointer. */
  collision?: CollisionStrategy;
  /** Trailing inline fraction of a row that drops into its child list (trees). */
  nestZone?: number;
  /** Localized strings; English defaults fill the rest. */
  messages?: DragMessagesOverrides;
  formatNumber?: (value: number) => string;
  /** Polite announcer. Default: `@texuli/core/announcer` for this document. */
  announce?: (message: string) => void;
  /** `in-place` reorders the lists live; `overlay` moves the item and shows drop indicators. */
  preview?: 'in-place' | 'overlay';
  /** Auto-scroll the nearest scrollable ancestors near their edges (`false` turns it off). */
  autoScroll?: boolean | AutoScrollOptions;
  /** Touch hold (ms) before a drag starts; touches that move first scroll the page. */
  longPress?: number;
  /** Called with each committed move. Return false to apply it yourself (or not at all). */
  // biome-ignore lint/suspicious/noConfusingVoidType: Hosts may return nothing to accept the move.
  onMove?: (move: SortableMove) => boolean | void;
  onEvent?: (event: SortableEvent) => void;
  children?: Snippet;
};

let {
  containers = $bindable(),
  selection = [],
  mode = 'insert',
  filter,
  isLocked,
  canDrop,
  maxDepth,
  cloneId,
  crossContainers = false,
  modifiers = [],
  collision,
  nestZone,
  messages,
  formatNumber,
  announce,
  preview = 'in-place',
  autoScroll = true,
  longPress,
  onMove,
  onEvent,
  children,
  ...rest
}: Props = $props();

const uid = $props.id();
const instructionsId = `${uid}-sortable-instructions`;
const resolved = $derived(resolveDragMessages(messages));
const lists = new Map<string, HTMLElement>();
const items = new Map<string, HTMLElement>();
const handles = new Map<string, HTMLElement>();
const itemLabels = new Map<string, string>();
const listLabels = new Map<string, string>();
let root: HTMLElement | null = null;
let dragState = $state.raw<SortableState>({
  phase: 'idle',
  input: null,
  source: null,
  target: null,
  verdict: null,
  move: null,
  delta: { x: 0, y: 0 },
});

function say(message: string): void {
  if (announce) {
    announce(message);
    return;
  }
  const doc = root?.ownerDocument;
  if (doc) getAnnouncer(doc).announce(message, 'polite');
}

let activeRect: Rect | null = null;
// The controller is rebuilt only when the messages change (never mid-drag in practice).
const controller = $derived.by(() => {
  const strings = resolved;
  return untrack(() =>
    createSortable({
      // Rules are getters, so prop changes apply to the next plan.
      filter: (id: string) => filter?.(id) ?? false,
      isLocked: (id: string) => isLocked?.(id) ?? false,
      get mode() {
        return mode;
      },
      get canDrop() {
        return canDrop;
      },
      get maxDepth() {
        return maxDepth;
      },
      get cloneId() {
        return cloneId;
      },
      get crossContainers() {
        return crossContainers;
      },
      containers,
      // The pointer tracker already applies the 4 px threshold.
      threshold: 0,
      transform: (delta: Point) => applyModifiers(modifiers, delta, { activeRect }),
      messages: strings,
      ...(formatNumber ? { formatNumber } : {}),
      announce: say,
      labelOf: (id: string) => itemLabels.get(id) ?? id,
      containerLabelOf: (id: string) => listLabels.get(id) ?? id,
      onEvent: (event: SortableEvent) => onEvent?.(event),
    })
  );
});

$effect.pre(() => {
  const next = containers;
  untrack(() => {
    if (controller.state.phase === 'idle') controller.setContainers(next);
  });
});

/** Publish the engine state; animate reorders (FLIP) unless motion is reduced. */
function sync(): void {
  const next = controller.state;
  const previous = dragState;
  const reordered =
    preview === 'in-place' &&
    (previous.target?.containerId !== next.target?.containerId ||
      previous.target?.index !== next.target?.index ||
      previous.phase !== next.phase);
  const animate = reordered && root !== null && !reducedMotion(root);
  const before = animate ? snapshotRects(items) : null;
  dragState = next;
  if (before) {
    const skip = new Set(next.input === 'pointer' ? (next.source?.ids ?? []) : []);
    void tick().then(() => playFlip(before, items, skip));
  }
}

function commit(move: SortableMove | null): void {
  if (!move?.changed) return;
  if (onMove?.(move) === false) return;
  containers = applyMove(containers, move);
  controller.setContainers(containers);
}

function refocus(id: string): void {
  void tick().then(() => {
    const handle = handles.get(id);
    if (handle && handle.ownerDocument.activeElement !== handle) handle.focus();
  });
}

function refuse(id: string, verdict: DropVerdict): void {
  if (verdict.ok) return;
  say(
    formatRefusal(
      resolved,
      verdict.reason,
      { item: itemLabels.get(id) ?? id },
      formatNumber ? { formatNumber } : {}
    )
  );
}

const sourceIds = () => dragState.source?.ids ?? [];
const nested = () => containers.some((container) => container.parentId != null);

function containerOf(id: string): SortableContainer | undefined {
  return containers.find((container) => container.items.includes(id));
}

function keydown(id: string, event: KeyboardEvent, handle: HTMLElement): void {
  const state = controller.state;
  if (state.input === 'pointer' && state.phase !== 'idle') return;
  const dragging = state.phase === 'dragging' && (state.source?.ids.includes(id) ?? false);
  const container = containerOf(id);
  const direction = directionOf(handle);
  const intent = sortableIntent(event, {
    dragging,
    direction,
    nested: nested(),
    ...(container?.orientation ? { orientation: container.orientation } : {}),
  });
  if (!intent) return;
  // Tab cancels and still moves focus on.
  if (event.key !== 'Tab') event.preventDefault();
  if (intent === 'pickUp') {
    if (state.phase !== 'idle') return;
    const verdict = controller.pickUp(id, { input: 'keyboard', fromHandle: true, selection });
    refuse(id, verdict);
  } else if (intent === 'drop') {
    commit(controller.drop());
  } else if (intent === 'cancel') {
    controller.cancel();
  } else {
    controller.intent(intent);
  }
  sync();
  if (event.key !== 'Tab') refocus(id);
}

// ---------------------------------------------------------------------------
// Pointer drags

let snapshot: SortableSnapshot | null = null;
let scroller: AutoScroller | null = null;
let stopListening: (() => void) | null = null;

function measure(): void {
  snapshot = createSortableSnapshot(measureContainers({ containers, lists, items }));
}

function pointerTarget() {
  return { ...(collision ? { collision } : {}), ...(nestZone === undefined ? {} : { nestZone }) };
}

function endPointer(): void {
  scroller?.stop();
  scroller = null;
  stopListening?.();
  stopListening = null;
  snapshot = null;
  activeRect = null;
}

function startPointer(id: string, origin: Point, point: Point, handle: HTMLElement): void {
  if (controller.state.phase !== 'idle') return;
  const element = items.get(id);
  activeRect = element ? rectOf(element) : null;
  const verdict = controller.pickUp(id, {
    input: 'pointer',
    point: origin,
    fromHandle: true,
    selection,
  });
  if (!verdict.ok) {
    refuse(id, verdict);
    return;
  }
  measure();
  const doc = handle.ownerDocument;
  const view = doc.defaultView;
  if (autoScroll !== false && view && element) {
    const targets = scrollTargets(element);
    scroller = createAutoScroller({
      ...(typeof autoScroll === 'object' ? autoScroll : {}),
      frame: {
        request: (callback) => view.requestAnimationFrame(callback),
        cancel: (frame) => view.cancelAnimationFrame(frame),
      },
      targets: () => targets,
      onScroll: () => measure(),
    });
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      controller.cancel();
      endPointer();
      sync();
    }
  };
  // Rects are re-measured on scroll only.
  const onScroll = () => measure();
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('scroll', onScroll, true);
  stopListening = () => {
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('scroll', onScroll, true);
  };
  movePointer(point);
}

function movePointer(point: Point): void {
  if (controller.state.input !== 'pointer' || !snapshot) return;
  controller.pointerMove(point, snapshot, pointerTarget());
  scroller?.update(point);
  sync();
}

// One tracker per root. Pointer capture goes to the root element, which never
// moves: in-place previews reorder (and remount) items mid-drag, and a moved
// or removed element would lose its capture and cancel the drag.
let tracker: PointerTracker | null = null;
let activeId: string | null = null;
let activeHandle: HTMLElement | null = null;
let release: (() => void) | null = null;

function finishPointer(): void {
  release?.();
  release = null;
  activeId = null;
  activeHandle = null;
  endPointer();
  sync();
}

function ensureTracker(view: Window | null): PointerTracker {
  if (tracker) return tracker;
  tracker = createPointerTracker({
    ...(longPress !== undefined && view
      ? {
          longPress: { delay: longPress },
          timer: {
            set: (callback: () => void, ms: number) => view.setTimeout(callback, ms),
            clear: (timer: number) => view.clearTimeout(timer),
          },
        }
      : {}),
    onStart: (event) => {
      if (activeId !== null && activeHandle)
        startPointer(activeId, event.origin, event.point, activeHandle);
    },
    onMove: (event) => movePointer(event.point),
    onEnd: () => {
      if (controller.state.input === 'pointer' && controller.state.phase === 'dragging') {
        commit(controller.drop());
      }
      finishPointer();
    },
    onCancel: () => {
      if (controller.state.input === 'pointer') controller.cancel();
      finishPointer();
    },
    onClick: () => finishPointer(),
  });
  return tracker;
}

function listen(pointerId: number, doc: Document): void {
  const active = tracker;
  if (!active || !root) return;
  const target: HTMLElement | Document = capturePointer(root, pointerId) ? root : doc;
  const settle = () => {
    // A long-press abandoned for a scroll leaves the tracker idle without a callback.
    if (active.phase === 'idle' && release) finishPointer();
  };
  const onMove = (event: PointerEvent) => {
    active.move(event);
    settle();
  };
  const onUp = (event: PointerEvent) => {
    active.up(event);
    settle();
  };
  const onCancel = (event: PointerEvent) => {
    active.cancel(event);
    settle();
  };
  const listeners: [string, (event: PointerEvent) => void][] = [
    ['pointermove', onMove],
    ['pointerup', onUp],
    ['pointercancel', onCancel],
    ['lostpointercapture', onCancel],
  ];
  for (const [type, listener] of listeners)
    target.addEventListener(type, listener as EventListener);
  release = () => {
    for (const [type, listener] of listeners)
      target.removeEventListener(type, listener as EventListener);
    if (target === root) {
      try {
        root.releasePointerCapture(pointerId);
      } catch {
        // Already released by the browser.
      }
    }
  };
}

function pointer(id: string): Attachment<HTMLElement> {
  return (handle) => {
    const onDown = (event: PointerEvent) => {
      if (!root || release) return;
      const doc = handle.ownerDocument;
      if (!ensureTracker(doc.defaultView).down(event)) return;
      activeId = id;
      activeHandle = handle;
      listen(event.pointerId, doc);
    };
    handle.addEventListener('pointerdown', onDown);
    // Unmounting a handle (an in-place move across lists) never cancels the drag.
    return () => handle.removeEventListener('pointerdown', onDown);
  };
}

// ---------------------------------------------------------------------------
// Rendering helpers

function order(containerId: string): readonly string[] {
  const container = containers.find((entry) => entry.id === containerId);
  const base = container?.items ?? [];
  const move = dragState.move;
  if (preview !== 'in-place' || dragState.phase !== 'dragging' || !move || move.kind === 'clone')
    return base;
  return move.next[containerId] ?? base;
}

function indicator(itemId: string): DropIndicator | null {
  const { target, phase, move } = dragState;
  if (phase !== 'dragging' || !target || !dragState.verdict?.ok) return null;
  if (preview === 'in-place' && move?.kind !== 'clone') return null;
  const container = containers.find((entry) => entry.id === target.containerId);
  if (!container) return null;
  if (mode === 'swap') return container.items[target.index] === itemId ? 'before' : null;
  const moving = new Set(sourceIds());
  const remaining = container.items.filter((id) => !moving.has(id));
  if (target.index < remaining.length) return remaining[target.index] === itemId ? 'before' : null;
  return remaining.at(-1) === itemId ? 'after' : null;
}

function register(map: Map<string, HTMLElement>, labels: Map<string, string> | null) {
  return (id: string, element: HTMLElement, label?: string) => {
    map.set(id, element);
    if (labels && label) labels.set(id, label);
    return () => {
      if (map.get(id) === element) map.delete(id);
    };
  };
}

sortableContext.set({
  state: () => dragState,
  messages: () => resolved,
  instructionsId,
  order,
  container: (id) => containers.find((entry) => entry.id === id),
  isDragging: (id) => dragState.phase === 'dragging' && sourceIds().includes(id),
  isSelected: (id) => selection.includes(id),
  isLocked: (id) =>
    (isLocked?.(id) ?? false) ||
    containers.some((container) => container.locked?.includes(id) ?? false),
  indicator,
  translate: (id) => {
    if (preview !== 'overlay' || dragState.input !== 'pointer' || !sourceIds().includes(id))
      return undefined;
    return `${dragState.delta.x}px ${dragState.delta.y}px`;
  },
  registerList: register(lists, listLabels),
  registerItem: register(items, itemLabels),
  registerHandle: register(handles, null),
  keydown,
  pointer,
});

const attachRoot: Attachment<HTMLElement> = (node) => {
  root = node;
  return () => {
    tracker?.cancel();
    if (controller.state.phase !== 'idle') controller.cancel();
    release?.();
    release = null;
    endPointer();
    root = null;
  };
};

const instructions = $derived(formatDragMessage(resolved.instructions, {}));
</script>

<div
  {...rest}
  class={`tx-sortable ${rest.class ?? ''}`.trim()}
  data-dragging={dragState.phase === 'dragging' ? '' : undefined}
  data-input={dragState.input ?? undefined}
  {@attach attachRoot}
>
  <span id={instructionsId} hidden>{instructions}</span>
  {@render children?.()}
</div>
