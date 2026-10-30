<script lang="ts">
// The infinite canvas surface: the only `role="application"` region, so
// screen readers hand keys to it. Shapes are SVG groups with a roving tab
// stop in reading order; pointers draw, select, move, resize, rotate and
// connect; the wheel pans (zooms with Control or Command); two fingers pinch.
import { animate } from '@texuli/core/motion';
import type { HrefTrust } from '@texuli/core/url-policy';
import {
  capturePointer,
  createPointerTracker,
  type GestureElement,
  type PointerTracker,
} from '@texuli/drag/gesture';
import { type ResizeHandle, screenToWorld, type ViewTransform } from '@texuli/drag/spatial';
import { type Snippet, tick, untrack } from 'svelte';
import { getMotionSettings } from 'texuli/motion';
import { routeConnector } from '../model/connectors.ts';
import {
  indexShapes,
  isContainer,
  rotatePoint,
  shapeAt,
  shapeBounds,
  shapesInRect,
} from '../model/document.ts';
import {
  angleTo,
  frameAt,
  moveOps,
  reparentOps,
  resizeOps,
  rotateOps,
  snapMove,
} from '../model/edit.ts';
import { applyCanvasOps, type CanvasOperation } from '../model/ops.ts';
import { dashArray, PALETTE_TOKENS, resolvePaint } from '../model/paint.ts';
import { pathFromPoints } from '../model/simplify.ts';
import type {
  CanvasConnector,
  CanvasDocument,
  CanvasRect,
  CanvasShape,
  CanvasXY,
} from '../model/types.ts';
import type { CanvasController } from './controller.svelte.ts';
import { type CanvasCommand, canvasCommand } from './keyboard.ts';
import ShapeView, { type ShapeFocus } from './ShapeView.svelte';

interface Props {
  controller: CanvasController;
  trust?: HrefTrust;
  resolveImage?: (ref: string) => string | null | undefined;
  /** Fit the content once the surface has a size. Default true. */
  fitOnMount?: boolean;
  /** Overlays inside the viewport (the minimap). */
  children?: Snippet;
  class?: string;
}

let {
  controller,
  trust = 'untrusted',
  resolveImage,
  fitOnMount = true,
  children,
  class: className = '',
}: Props = $props();

const uid = $props.id();
const helpId = `${uid}-help`;
const motion = getMotionSettings();
let root = $state<HTMLDivElement>();
let viewport = $state<HTMLDivElement>();
let world = $state<SVGGElement>();
let editor = $state<HTMLTextAreaElement>();

/** Resize and rotate previews render this instead of the document. */
let preview = $state.raw<CanvasDocument | null>(null);
const doc = $derived(preview ?? controller.doc);
const index = $derived(indexShapes(doc));
const lookup = $derived(new Map([...index].map(([id, entry]) => [id, entry.shape])));
const order = $derived(controller.order);
const tabStop = $derived(
  controller.focusId !== null && index.has(controller.focusId)
    ? controller.focusId
    : (order[0] ?? null)
);
const L = $derived(controller.labels);

/** Shapes moving with the pointer (roots of the selection) and their subtrees. */
let dragIds = $state.raw<ReadonlySet<string>>(new Set());
const dragged = $derived.by(() => {
  const out = new Set<string>();
  for (const id of dragIds) {
    const entry = index.get(id);
    if (!entry) continue;
    const stack: CanvasShape[] = [entry.shape];
    while (stack.length > 0) {
      const shape = stack.pop() as CanvasShape;
      out.add(shape.id);
      if (isContainer(shape)) stack.push(...shape.children);
    }
  }
  return out;
});

function moved(shape: CanvasShape): CanvasShape {
  const { x: dx, y: dy } = controller.dragOffset;
  if (shape.type === 'group') return { ...shape, children: shape.children.map(moved) };
  const next = { ...shape, x: shape.x + dx, y: shape.y + dy };
  return isContainer(next)
    ? ({ ...next, children: next.children.map(moved) } as CanvasShape)
    : next;
}

const routes = $derived.by(() => {
  const map = dragged.size > 0 ? new Map(lookup) : lookup;
  if (dragged.size > 0) for (const id of dragged) map.set(id, moved(lookup.get(id) as CanvasShape));
  return doc.connectors.flatMap((connector) => {
    const route = routeConnector(connector, map);
    return route ? [{ connector, route, style: resolvePaint(connector, 'connector') }] : [];
  });
});

const focus: ShapeFocus = {
  get tabStop() {
    return tabStop;
  },
  get selection() {
    return controller.selection;
  },
  get target() {
    return controller.connecting?.target ?? null;
  },
  get editing() {
    return controller.editing;
  },
  name: (shape) => {
    const name = controller.nameOf(shape.id);
    return controller.selection.has(shape.id) ? `${name}, selected` : name;
  },
  kind: (shape) => controller.label(L.kinds[shape.type] ?? shape.type),
};

/** The single selected shape gets handles (the select tool only). */
const handleShape = $derived.by(() => {
  if (controller.tool !== 'select' || controller.readonly || controller.selection.size !== 1)
    return null;
  const id = [...controller.selection][0] as string;
  const shape = index.get(id)?.shape;
  return shape && !shape.locked ? shape : null;
});
const selectionBoxes = $derived(
  [...controller.selection].flatMap((id) => {
    const shape = index.get(id)?.shape;
    if (!shape) return [];
    const box = shapeBounds(dragged.has(id) ? moved(shape) : shape);
    return [{ id, box }];
  })
);

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function handlePoint(shape: CanvasShape, handle: ResizeHandle | 'rotate'): CanvasXY {
  if (shape.type === 'group') {
    const b = shapeBounds(shape);
    return handleOnBox(b, handle);
  }
  const box = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return rotatePoint(handleOnBox(box, handle), center, shape.rotation ?? 0);
}

function handleOnBox(b: CanvasRect, handle: ResizeHandle | 'rotate'): CanvasXY {
  if (handle === 'rotate') return { x: b.x + b.width / 2, y: b.y - 28 / controller.view.zoom };
  const x = handle.includes('w') ? b.x : handle.includes('e') ? b.x + b.width : b.x + b.width / 2;
  const y = handle.includes('n') ? b.y : handle.includes('s') ? b.y + b.height : b.y + b.height / 2;
  return { x, y };
}

// ── view: transform, motion, wheel and pinch ───────────────────────────

const transformOf = (view: ViewTransform) =>
  `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
let shownView: ViewTransform | null = null;
$effect(() => {
  const view = controller.view;
  const element = world;
  if (!element) return;
  const from = untrack(() => shownView) ?? view;
  shownView = view;
  if (!controller.animateNext) return;
  controller.animateNext = false;
  // Buttons and keys glide; reduced motion and level `none` commit at once.
  animate(element, [{ transform: transformOf(from) }, { transform: transformOf(view) }], {
    duration: 200,
    level: motion.level,
    reducedMotion: motion.reducedMotion,
  });
});

let fitted = false;
$effect(() => {
  if (fitted || !fitOnMount || controller.viewport.width <= 0 || controller.viewport.height <= 0)
    return;
  fitted = true;
  untrack(() => controller.fit(undefined, false));
});

$effect(() => {
  const element = viewport;
  if (!element) return;
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey)
      controller.zoomBy(
        Math.exp(-event.deltaY * 0.002),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        false
      );
    else controller.panBy({ x: -event.deltaX, y: -event.deltaY });
  };
  element.addEventListener('wheel', onWheel, { passive: false });
  return () => element.removeEventListener('wheel', onWheel);
});

// Move DOM focus where the controller asks.
$effect(() => {
  const target = controller.pendingFocus;
  if (target === null || !root) return;
  const host = root;
  void tick().then(() => {
    if (controller.pendingFocus !== target) return;
    controller.pendingFocus = null;
    if (target === '') {
      viewport?.focus({ preventScroll: true });
      return;
    }
    for (const element of host.querySelectorAll<SVGGElement>('[data-tx-shape]'))
      if (element.dataset.txShape === target) {
        element.focus({ preventScroll: true });
        return;
      }
  });
});

// The text box takes focus when editing starts.
$effect(() => {
  if (controller.editing !== null && editor) {
    const element = editor;
    void tick().then(() => element.focus({ preventScroll: true }));
  }
});

// ── pointer gestures ───────────────────────────────────────────────────

type Gesture =
  | { kind: 'move'; ids: string[] }
  | { kind: 'pan'; start: ViewTransform }
  | { kind: 'marquee'; from: CanvasXY; additive: boolean }
  | { kind: 'draw'; from: CanvasXY; points: CanvasXY[] }
  | { kind: 'box'; from: CanvasXY }
  | { kind: 'resize'; id: string; handle: ResizeHandle }
  | { kind: 'rotate'; id: string }
  | { kind: 'wire'; from: { shape: string } | CanvasXY; to: CanvasXY };

let tracker: PointerTracker | null = null;
let gesture = $state.raw<Gesture | null>(null);
let origin = { left: 0, top: 0 };
let pending: CanvasOperation[] = [];
const pointers = new Map<number, CanvasXY>();
/** Modifier keys during a drag (Shift keeps aspect or frees rotation; Alt skips the grid). */
const modifiers = { shift: false, alt: false };
let pinch: { distance: number; view: ViewTransform; mid: CanvasXY } | null = null;

function toWorld(point: CanvasXY): CanvasXY {
  return screenToWorld({ x: point.x - origin.left, y: point.y - origin.top }, controller.view);
}

function finish(): void {
  tracker = null;
  gesture = null;
  preview = null;
  dragIds = new Set();
  controller.dragOffset = { x: 0, y: 0 };
  controller.guides = [];
  controller.marquee = null;
  controller.draft = null;
  pending = [];
}

function boxOf(a: CanvasXY, b: CanvasXY): CanvasRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function draftFor(active: Gesture, point: CanvasXY): CanvasShape | null {
  const tool = controller.tool;
  if (active.kind === 'draw')
    return pathFromPoints('draft', active.points, { tolerance: 1 / controller.view.zoom });
  if (active.kind !== 'box') return null;
  if (tool === 'line' || tool === 'arrow') {
    const b = boxOf(active.from, point);
    return {
      id: 'draft',
      type: tool,
      ...b,
      points: [
        [active.from.x - b.x, active.from.y - b.y],
        [point.x - b.x, point.y - b.y],
      ],
    };
  }
  const b = boxOf(active.from, point);
  if (tool === 'frame') return { id: 'draft', type: 'frame', ...b, children: [] };
  if (tool === 'text' || tool === 'sticky') return { id: 'draft', type: tool, ...b, text: '' };
  if (tool === 'rect' || tool === 'ellipse' || tool === 'diamond')
    return { id: 'draft', type: tool, ...b };
  return null;
}

function begin(event: PointerEvent, next: Gesture): void {
  if (tracker !== null || !root || !viewport) return;
  const rect = viewport.getBoundingClientRect();
  origin = { left: rect.left, top: rect.top };
  const active = next;
  const created = createPointerTracker({
    threshold: active.kind === 'draw' ? 0 : 3,
    onStart() {
      if (active.kind === 'move') dragIds = new Set(active.ids);
    },
    onMove(e) {
      const point = toWorld(e.point);
      const delta = { x: e.delta.x / controller.view.zoom, y: e.delta.y / controller.view.zoom };
      if (active.kind === 'move') {
        const snapped = controller.snap
          ? snapMove(controller.doc, active.ids, delta, {
              grid: modifiers.alt ? 0 : controller.grid,
              threshold: 6 / controller.view.zoom,
            })
          : { delta, guides: [] };
        controller.dragOffset = snapped.delta;
        controller.guides = snapped.guides;
      } else if (active.kind === 'pan') {
        controller.setView({
          ...active.start,
          x: active.start.x + e.delta.x,
          y: active.start.y + e.delta.y,
        });
      } else if (active.kind === 'marquee') {
        controller.marquee = boxOf(active.from, point);
      } else if (active.kind === 'draw') {
        if (active.points.length < 100_000) active.points.push(point);
        controller.draft = draftFor(active, point);
      } else if (active.kind === 'box') {
        controller.draft = draftFor(active, point);
      } else if (active.kind === 'resize') {
        pending = resizeOps(controller.doc, active.id, active.handle, delta, {
          keepAspect: modifiers.shift,
          grid: controller.snap ? controller.grid : undefined,
        });
        const result = applyCanvasOps(controller.doc, pending, { trust });
        preview = result.ok ? result.doc : null;
      } else if (active.kind === 'rotate') {
        const shape = index.get(active.id)?.shape ?? lookup.get(active.id);
        if (!shape) return;
        pending = rotateOps(controller.doc, active.id, angleTo(shape, point), {
          snap: modifiers.shift ? 0 : 15,
        });
        const result = applyCanvasOps(controller.doc, pending, { trust });
        preview = result.ok ? result.doc : null;
      } else if (active.kind === 'wire') {
        gesture = { ...active, to: point };
      }
    },
    onEnd(e) {
      const point = toWorld(e.point);
      if (active.kind === 'move') {
        const delta = controller.dragOffset;
        const ops = moveOps(controller.doc, active.ids, delta);
        // Dropped wholly inside a frame: into it; dragged out of its frame: to the top level.
        const after = applyCanvasOps(controller.doc, ops, { trust });
        let extra: CanvasOperation[] = [];
        if (after.ok) {
          const bounds = active.ids
            .map((id) => indexShapes(after.doc).get(id)?.shape)
            .filter(Boolean) as CanvasShape[];
          const box = bounds.reduce<CanvasRect | null>((acc, shape) => {
            const b = shapeBounds(shape);
            if (!acc) return b;
            const x = Math.min(acc.x, b.x);
            const y = Math.min(acc.y, b.y);
            return {
              x,
              y,
              width: Math.max(acc.x + acc.width, b.x + b.width) - x,
              height: Math.max(acc.y + acc.height, b.y + b.height) - y,
            };
          }, null);
          if (box) extra = reparentOps(after.doc, active.ids, frameAt(after.doc, box, active.ids));
        }
        controller.apply(
          [...ops, ...extra],
          controller.label(L.moved, {
            name:
              active.ids.length === 1
                ? controller.nameOf(active.ids[0] as string)
                : `${active.ids.length}`,
            x: Math.round(point.x),
            y: Math.round(point.y),
          })
        );
      } else if (active.kind === 'marquee') {
        const box = boxOf(active.from, point);
        const hits = shapesInRect(controller.doc, box, 'intersect').filter(
          (id) => !index.get(id)?.parent
        );
        controller.select(active.additive ? [...controller.selection, ...hits] : hits);
      } else if (active.kind === 'draw') {
        const shape = pathFromPoints('x', active.points, { tolerance: 1 / controller.view.zoom });
        if (shape) {
          const { id: _ignored, ...rest } = shape;
          controller.add(rest);
        }
      } else if (active.kind === 'box') {
        const b = boxOf(active.from, point);
        const tool = controller.tool;
        if (tool === 'line' || tool === 'arrow') {
          if (b.width + b.height < 4) controller.createAt(active.from);
          else {
            const draft = draftFor(active, point);
            if (draft) {
              const { id: _ignored, ...rest } = draft;
              controller.add(rest);
              controller.tool = 'select';
            }
          }
        } else if (b.width < 4 && b.height < 4) controller.createAt(active.from);
        else controller.createAt({ x: b.x, y: b.y }, { width: b.width, height: b.height });
      } else if (active.kind === 'resize' || active.kind === 'rotate') {
        if (pending.length > 0) {
          const name = controller.nameOf(active.id);
          const entry = preview ? indexShapes(preview).get(active.id)?.shape : null;
          const b = entry ? shapeBounds(entry) : null;
          controller.apply(
            pending,
            active.kind === 'resize'
              ? controller.label(L.resized, {
                  name,
                  width: Math.round(b?.width ?? 0),
                  height: Math.round(b?.height ?? 0),
                })
              : controller.label(L.rotated, {
                  name,
                  degrees: Math.round((entry && entry.type !== 'group' ? entry.rotation : 0) ?? 0),
                })
          );
        }
      } else if (active.kind === 'wire') {
        const hit = shapeAt(controller.doc, point, 6 / controller.view.zoom);
        const target = hit && index.get(hit)?.shape.type !== 'group' ? { shape: hit } : point;
        const source = active.from;
        if (!('shape' in target && 'shape' in source && target.shape === source.shape))
          controller.connectEnds(source, target);
        controller.tool = 'select';
      }
      finish();
    },
    onCancel() {
      if (active.kind === 'pan') controller.setView(active.start);
      finish();
    },
    onClick(e) {
      const point = toWorld(e.point);
      if (active.kind === 'move') {
        const id = active.ids[0] as string;
        controller.focusId = id;
      } else if (active.kind === 'pan' || (active.kind === 'marquee' && !active.additive)) {
        controller.clearSelection();
      } else if (active.kind === 'box') controller.createAt(point);
      else if (active.kind === 'draw') {
        const shape = pathFromPoints('x', [active.from], {});
        if (shape) {
          const { id: _ignored, ...rest } = shape;
          controller.add(rest);
        }
      } else if (active.kind === 'wire') controller.tool = 'select';
      finish();
    },
  });
  if (!created.down(event)) return;
  tracker = created;
  gesture = next;
  capturePointer(root as unknown as GestureElement, event.pointerId);
}

function shapeIdFrom(target: EventTarget | null): string | null {
  const element = (target as Element | null)?.closest?.('[data-tx-shape]') as SVGGElement | null;
  if (!element) return null;
  // Group members act as their outermost group; frame children act alone.
  let id = element.dataset.txShape ?? null;
  let entry = id ? index.get(id) : undefined;
  while (entry?.parent && entry.parent.type === 'group') {
    id = entry.parent.id;
    entry = index.get(id);
  }
  return id;
}

function onPointerDown(event: PointerEvent): void {
  if (controller.editing !== null) return;
  const rect = viewport?.getBoundingClientRect();
  if (rect) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    // Two fingers: pinch to zoom, pan with the midpoint.
    tracker?.cancel();
    const [a, b] = [...pointers.values()] as [CanvasXY, CanvasXY];
    pinch = {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      view: controller.view,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    return;
  }
  const target = event.target as Element;
  const handle = target.closest?.('[data-tx-handle]') as SVGElement | null;
  if (handle && handleShape) {
    event.stopPropagation();
    const name = handle.getAttribute('data-tx-handle') as ResizeHandle | 'rotate';
    begin(
      event,
      name === 'rotate'
        ? { kind: 'rotate', id: handleShape.id }
        : { kind: 'resize', id: handleShape.id, handle: name }
    );
    return;
  }
  const rectNow = viewport?.getBoundingClientRect();
  origin = { left: rectNow?.left ?? 0, top: rectNow?.top ?? 0 };
  const point = toWorld({ x: event.clientX, y: event.clientY });
  const tool = controller.tool;
  const id = shapeIdFrom(target);
  const connectorId = (target.closest?.('[data-tx-connector]') as SVGElement | null)?.getAttribute(
    'data-tx-connector'
  );
  if (event.button === 1 || tool === 'hand') {
    begin(event, { kind: 'pan', start: controller.view });
    return;
  }
  if (controller.readonly) {
    if (id) {
      controller.select([id]);
      controller.focusId = id;
    } else begin(event, { kind: 'pan', start: controller.view });
    return;
  }
  if (tool === 'connector') {
    begin(event, { kind: 'wire', from: id ? { shape: id } : point, to: point });
    return;
  }
  if (tool === 'draw') {
    begin(event, { kind: 'draw', from: point, points: [point] });
    return;
  }
  if (tool !== 'select') {
    begin(event, { kind: 'box', from: point });
    return;
  }
  if (connectorId) {
    controller.select([connectorId]);
    return;
  }
  if (id) {
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    if (additive) controller.toggle(id);
    else if (!controller.selection.has(id)) controller.select([id]);
    controller.focusId = id;
    const ids = [...controller.selection].filter(
      (each) => index.has(each) && !index.get(each)?.shape.locked
    );
    if (ids.length > 0 && !additive) begin(event, { kind: 'move', ids });
    return;
  }
  begin(event, { kind: 'marquee', from: point, additive: event.shiftKey });
}

function onPointerMove(event: PointerEvent): void {
  modifiers.shift = event.shiftKey;
  modifiers.alt = event.altKey;
  if (pointers.has(event.pointerId))
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && pointers.size === 2 && viewport) {
    const [a, b] = [...pointers.values()] as [CanvasXY, CanvasXY];
    const rect = viewport.getBoundingClientRect();
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const factor = pinch.distance > 0 ? distance / pinch.distance : 1;
    const zoom = Math.min(8, Math.max(0.1, pinch.view.zoom * factor));
    const anchor = { x: pinch.mid.x - rect.left, y: pinch.mid.y - rect.top };
    const worldAnchor = screenToWorld(anchor, pinch.view);
    controller.setView({
      x: mid.x - rect.left - worldAnchor.x * zoom,
      y: mid.y - rect.top - worldAnchor.y * zoom,
      zoom,
    });
    return;
  }
  tracker?.move(event);
}

function onPointerEnd(event: PointerEvent, cancel = false): void {
  pointers.delete(event.pointerId);
  if (pinch) {
    if (pointers.size < 2) pinch = null;
    return;
  }
  if (cancel) tracker?.cancel(event);
  else tracker?.up(event);
}

function onDblClick(event: MouseEvent): void {
  const id = shapeIdFrom(event.target);
  if (id && controller.canEdit(id)) {
    controller.focusId = id;
    controller.startEdit(id);
  }
}

// ── keyboard ───────────────────────────────────────────────────────────

function run(command: CanvasCommand, id: string | null): boolean {
  const c = controller;
  switch (command.kind) {
    case 'next':
    case 'previous':
      return c.step(command.kind === 'next' ? 1 : -1);
    case 'move':
      if (id === null)
        c.panBy(
          {
            x: command.direction === 'left' ? 48 : command.direction === 'right' ? -48 : 0,
            y: command.direction === 'up' ? 48 : command.direction === 'down' ? -48 : 0,
          },
          true
        );
      else c.nudge(command.direction, command.fine);
      return true;
    case 'resize':
      if (id !== null) c.resizeBy(command.direction, command.fine);
      return id !== null;
    case 'rotate':
      c.rotateBy(command.degrees);
      return true;
    case 'edit':
      if (id !== null && c.canEdit(id)) c.startEdit(id);
      return true;
    case 'toggle':
      if (id !== null) c.toggle(id);
      return true;
    case 'remove':
      c.removeSelection();
      return true;
    case 'group':
      c.group();
      return true;
    case 'ungroup':
      c.ungroup();
      return true;
    case 'undo':
      c.undo();
      return true;
    case 'redo':
      c.redo();
      return true;
    case 'copy': {
      const text = c.copy();
      if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
      return true;
    }
    case 'cut': {
      const text = c.cut();
      if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
      return true;
    }
    case 'paste':
      // With nothing copied here, let the browser fire `paste` with the system clipboard.
      return c.paste();
    case 'duplicate':
      c.duplicate();
      return true;
    case 'selectAll':
      c.selectAll();
      return true;
    case 'escape':
      if (c.connecting) c.cancelConnect();
      else if (c.selection.size > 0) c.clearSelection();
      else if (c.tool !== 'select') c.chooseTool('select');
      else if (id !== null) c.pendingFocus = '';
      else return false;
      return true;
    case 'zoomIn':
      c.zoomIn();
      return true;
    case 'zoomOut':
      c.zoomOut();
      return true;
    case 'zoomReset':
      c.zoomReset();
      return true;
    case 'fit':
      c.fit();
      return true;
    case 'zoomSelection':
      c.fit(c.targets().length > 0 ? c.targets() : undefined);
      return true;
    case 'reorder':
      c.reorder(command.mode);
      return true;
    case 'connect':
      if (id !== null) c.startConnect(id);
      return true;
    case 'tool':
      c.chooseTool(command.tool);
      return true;
    case 'create':
      if (c.tool === 'select' || c.tool === 'hand' || c.tool === 'draw' || c.tool === 'connector')
        return false;
      c.createAt(c.viewCenter());
      return true;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (controller.editing !== null) return;
  if (gesture !== null) {
    if (event.key === 'Escape') {
      event.preventDefault();
      tracker?.cancel();
    }
    return;
  }
  const target = event.target as Element;
  const id = (target.closest?.('[data-tx-shape]') as SVGGElement | null)?.dataset.txShape ?? null;
  if (controller.connecting && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    const from = controller.connecting.from;
    controller.commitConnect(id ?? undefined);
    controller.focusId = from;
    controller.pendingFocus = from;
    return;
  }
  const command = canvasCommand(event, id === null ? 'surface' : 'shape');
  if (!command) return;
  if (id !== null && controller.focusId !== id) controller.focusId = id;
  if (run(command, id)) event.preventDefault();
}

function onFocusin(event: FocusEvent): void {
  const element = (event.target as Element).closest?.('[data-tx-shape]') as SVGGElement | null;
  const id = element?.dataset.txShape;
  if (id !== undefined && controller.focusId !== id) controller.focusId = id;
}

function onPaste(event: ClipboardEvent): void {
  if (controller.editing !== null) return;
  const text = event.clipboardData?.getData('text/plain');
  if (text && controller.paste(text)) event.preventDefault();
}

// ── text editing ───────────────────────────────────────────────────────

const editBox = $derived.by(() => {
  const id = controller.editing;
  const shape = id ? index.get(id)?.shape : undefined;
  if (!shape || shape.type === 'group') return null;
  const { x, y, zoom } = controller.view;
  const top = shape.type === 'frame' ? shape.y - 28 : shape.y;
  const height = shape.type === 'frame' ? 24 : shape.height;
  const text =
    shape.type === 'frame' ? (shape.title ?? '') : 'text' in shape ? (shape.text ?? '') : '';
  return {
    id: shape.id,
    text,
    left: shape.x * zoom + x,
    top: top * zoom + y,
    width: Math.max(80, shape.width * zoom),
    height: Math.max(28, height * zoom),
    size: Math.max(10, (shape.type === 'text' ? 18 : 16) * zoom),
  };
});

function onEditorKeydown(event: KeyboardEvent): void {
  const element = event.currentTarget as HTMLTextAreaElement;
  if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
    event.preventDefault();
    event.stopPropagation();
    if (editBox) controller.commitText(editBox.id, element.value);
  }
}

function onEditorBlur(event: FocusEvent): void {
  const element = event.currentTarget as HTMLTextAreaElement;
  if (editBox && controller.editing === editBox.id)
    controller.commitText(editBox.id, element.value);
}

const markerFill = 'var(--tx-foreground, CanvasText)';
const draftStyle = 'var(--tx-primary, Highlight)';
const wirePath = $derived.by(() => {
  if (gesture?.kind !== 'wire') return null;
  const from =
    'shape' in gesture.from
      ? (() => {
          const shape = lookup.get((gesture.from as { shape: string }).shape);
          if (!shape) return null;
          const b = shapeBounds(shape);
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        })()
      : gesture.from;
  if (!from) return null;
  return `M${from.x} ${from.y}L${gesture.to.x} ${gesture.to.y}`;
});

function connectorStroke(
  connector: CanvasConnector,
  style: ReturnType<typeof resolvePaint>
): string {
  void connector;
  return style.stroke === 'none' ? 'none' : PALETTE_TOKENS[style.stroke];
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -- keys reach the application region through bubbling from its focusable shapes. -->
<div
  bind:this={root}
  class={['tx-canvas-surface', className]}
  data-tool={controller.tool}
  data-readonly={controller.readonly || undefined}
  onpointermove={onPointerMove}
  onpointerup={(event) => onPointerEnd(event)}
  onpointercancel={(event) => onPointerEnd(event, true)}
>
  <span id={helpId} class="tx-canvas-sr-only">{controller.label(L.instructions)}</span>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -- role="application" is the interactive region: it takes focus to pan when no shape has it, and handles keys and pointers for its shapes. -->
  <div
    bind:this={viewport}
    class="tx-canvas-surface__viewport"
    role="application"
    aria-roledescription={controller.label(L.roleDescription)}
    aria-label={controller.doc.meta?.title ? `${controller.label(L.canvas)}: ${controller.doc.meta.title}` : controller.label(L.canvas)}
    aria-describedby={helpId}
    tabindex={tabStop === null ? 0 : -1}
    bind:clientWidth={controller.viewport.width}
    bind:clientHeight={controller.viewport.height}
    onpointerdown={onPointerDown}
    ondblclick={onDblClick}
    onkeydown={onKeydown}
    onfocusin={onFocusin}
    onpaste={onPaste}
  >
    <svg class="tx-canvas-surface__svg" width="100%" height="100%" aria-hidden={order.length === 0 ? 'true' : undefined}>
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={markerFill} />
        </marker>
        <marker id={`${uid}-dot`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
          <circle cx="5" cy="5" r="4" fill={markerFill} />
        </marker>
      </defs>
      <g class="tx-canvas-surface__world" bind:this={world} style:transform={transformOf(controller.view)}>
        {#each doc.shapes as shape (shape.id)}
          <ShapeView
            {shape}
            {trust}
            dir={controller.dir}
            {resolveImage}
            {uid}
            {focus}
            offsets={(id) => (dragIds.has(id) ? controller.dragOffset : null)}
            imageMissing={(alt) => controller.label(L.imageMissing, { name: alt })}
          />
        {/each}
        {#each routes as item (item.connector.id)}
          <g class="tx-canvas-connector" data-tx-connector={item.connector.id} data-selected={controller.selection.has(item.connector.id) || undefined}>
            <path class="tx-canvas-connector__hit" d={item.route.path} />
            <path
              class="tx-canvas-connector__line"
              d={item.route.path}
              stroke={connectorStroke(item.connector, item.style)}
              stroke-width={item.style.strokeWidth}
              stroke-dasharray={dashArray(item.style.dash, item.style.strokeWidth)}
              marker-start={(item.connector.startCap ?? 'none') === 'arrow' ? `url(#${uid}-arrow)` : item.connector.startCap === 'dot' ? `url(#${uid}-dot)` : undefined}
              marker-end={(item.connector.endCap ?? 'arrow') === 'arrow' ? `url(#${uid}-arrow)` : item.connector.endCap === 'dot' ? `url(#${uid}-dot)` : undefined}
            />
            {#if item.connector.text}
              <text class="tx-canvas-connector__label" x={item.route.mid.x} y={item.route.mid.y - 6} text-anchor="middle">{item.connector.text}</text>
            {/if}
          </g>
        {/each}
        {#each selectionBoxes as item (item.id)}
          <rect class="tx-canvas-surface__selection" x={item.box.x - 4 / controller.view.zoom} y={item.box.y - 4 / controller.view.zoom} width={item.box.width + 8 / controller.view.zoom} height={item.box.height + 8 / controller.view.zoom} stroke-width={1.5 / controller.view.zoom} />
        {/each}
        {#if handleShape && !gesture}
          {@const size = 10 / controller.view.zoom}
          {#if handleShape.type !== 'group'}
            {@const p = handlePoint(handleShape, 'rotate')}
            <circle class="tx-canvas-surface__handle" data-tx-handle="rotate" cx={p.x} cy={p.y} r={size / 1.6} stroke-width={1.5 / controller.view.zoom} />
          {/if}
          {#each HANDLES as name (name)}
            {@const p = handlePoint(handleShape, name)}
            <rect class="tx-canvas-surface__handle" data-tx-handle={name} data-handle={name} x={p.x - size / 2} y={p.y - size / 2} width={size} height={size} stroke-width={1.5 / controller.view.zoom} />
          {/each}
        {/if}
        {#each controller.guides as guide, i (i)}
          {#if guide.axis === 'x'}
            <line class="tx-canvas-surface__guide" x1={guide.position} x2={guide.position} y1={-1e6} y2={1e6} stroke-width={1 / controller.view.zoom} />
          {:else}
            <line class="tx-canvas-surface__guide" y1={guide.position} y2={guide.position} x1={-1e6} x2={1e6} stroke-width={1 / controller.view.zoom} />
          {/if}
        {/each}
        {#if controller.draft}
          <g class="tx-canvas-surface__draft" opacity="0.7">
            <ShapeView shape={controller.draft} {trust} dir={controller.dir} {uid} />
          </g>
        {/if}
        {#if wirePath}
          <path class="tx-canvas-surface__wire" d={wirePath} stroke={draftStyle} stroke-width={2 / controller.view.zoom} />
        {/if}
        {#if controller.marquee}
          <rect class="tx-canvas-surface__marquee" x={controller.marquee.x} y={controller.marquee.y} width={controller.marquee.width} height={controller.marquee.height} stroke-width={1 / controller.view.zoom} />
        {/if}
      </g>
    </svg>
    {#if editBox}
      <!-- World coordinates are physical, so the text box is placed with left and top on purpose. -->
      <textarea
        bind:this={editor}
        class="tx-canvas-surface__editor"
        aria-label={controller.label(L.editText)}
        value={editBox.text}
        maxlength={5000}
        style:left={`${editBox.left}px`}
        style:top={`${editBox.top}px`}
        style:width={`${editBox.width}px`}
        style:height={`${editBox.height}px`}
        style:font-size={`${editBox.size}px`}
        onkeydown={onEditorKeydown}
        onblur={onEditorBlur}
      ></textarea>
    {/if}
    {@render children?.()}
  </div>
</div>

<style>
  @layer tx.components {
    .tx-canvas-surface {
      position: relative;
      display: grid;
      min-block-size: 20rem;
      color: var(--tx-foreground, CanvasText);
      background: var(--tx-surface, Canvas);
      color-scheme: light dark;
      overflow: hidden;
    }

    .tx-canvas-surface__viewport {
      position: relative;
      overflow: hidden;
      min-block-size: inherit;
      touch-action: none;
      cursor: default;
      background-image: radial-gradient(var(--tx-border, GrayText) 1px, transparent 1px);
      background-size: 16px 16px;
      outline: none;
    }

    .tx-canvas-surface__viewport:focus-visible {
      box-shadow: inset 0 0 0 var(--tx-focus-ring-width, 2px) var(--tx-ring, Highlight);
    }

    .tx-canvas-surface[data-tool='hand'] .tx-canvas-surface__viewport {
      cursor: grab;
    }

    .tx-canvas-surface:not([data-tool='select']):not([data-tool='hand']) .tx-canvas-surface__viewport {
      cursor: crosshair;
    }

    .tx-canvas-surface__svg {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
    }

    .tx-canvas-surface__world {
      transform-origin: 0 0;
    }

    .tx-canvas-sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .tx-canvas-surface :global(.tx-canvas-shape:focus-visible > :first-child) {
      stroke: var(--tx-ring, Highlight);
      stroke-width: 3px;
      paint-order: stroke;
    }

    .tx-canvas-surface :global(.tx-canvas-shape:focus-visible) {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 4px;
    }

    .tx-canvas-surface :global(.tx-canvas-shape[data-target]) {
      outline: 2px dashed var(--tx-primary, Highlight);
      outline-offset: 6px;
    }

    .tx-canvas-connector__hit {
      fill: none;
      stroke: transparent;
      stroke-width: 14;
      pointer-events: stroke;
    }

    .tx-canvas-connector__line {
      fill: none;
      pointer-events: none;
    }

    .tx-canvas-connector[data-selected] .tx-canvas-connector__line {
      stroke: var(--tx-primary, Highlight);
    }

    .tx-canvas-connector__label {
      fill: var(--tx-foreground, CanvasText);
      font-size: 13px;
      paint-order: stroke;
      stroke: var(--tx-surface, Canvas);
      stroke-width: 4px;
      pointer-events: none;
    }

    .tx-canvas-surface__selection {
      fill: none;
      stroke: var(--tx-primary, Highlight);
      pointer-events: none;
    }

    .tx-canvas-surface__handle {
      fill: var(--tx-surface, Canvas);
      stroke: var(--tx-primary, Highlight);
      cursor: pointer;
    }

    .tx-canvas-surface__handle[data-handle='n'],
    .tx-canvas-surface__handle[data-handle='s'] {
      cursor: ns-resize;
    }

    .tx-canvas-surface__handle[data-handle='e'],
    .tx-canvas-surface__handle[data-handle='w'] {
      cursor: ew-resize;
    }

    .tx-canvas-surface__handle[data-handle='nw'],
    .tx-canvas-surface__handle[data-handle='se'] {
      cursor: nwse-resize;
    }

    .tx-canvas-surface__handle[data-handle='ne'],
    .tx-canvas-surface__handle[data-handle='sw'] {
      cursor: nesw-resize;
    }

    .tx-canvas-surface__guide {
      stroke: var(--tx-destructive, Highlight);
      pointer-events: none;
    }

    .tx-canvas-surface__wire {
      fill: none;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }

    .tx-canvas-surface__marquee {
      fill: color-mix(in oklab, var(--tx-primary, Highlight) 12%, transparent);
      stroke: var(--tx-primary, Highlight);
      pointer-events: none;
    }

    .tx-canvas-surface__editor {
      position: absolute;
      box-sizing: border-box;
      padding: var(--tx-space-1) var(--tx-space-2);
      border: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      border-radius: var(--tx-shape-radius-sm);
      background: var(--tx-surface, Canvas);
      color: var(--tx-foreground, CanvasText);
      font-family: var(--tx-font-sans, system-ui, sans-serif);
      line-height: 1.3;
      resize: none;
    }

    @media (forced-colors: active) {
      .tx-canvas-connector__line,
      .tx-canvas-surface__selection,
      .tx-canvas-surface__handle,
      .tx-canvas-surface__marquee {
        stroke: Highlight;
      }

      .tx-canvas-surface :global(.tx-canvas-shape:focus-visible) {
        outline-color: Highlight;
      }
    }
  }
</style>
