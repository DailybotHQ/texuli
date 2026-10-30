<script lang="ts" generics="T">
import type { Point } from '@texuli/drag';
import { midpointIndex } from '@texuli/drag/collision';
import { bindPointerGesture, createPointerTracker } from '@texuli/drag/gesture';
import {
  type DragMessagesOverrides,
  type DragMessageValues,
  formatDragMessage,
  resolveDragMessages,
} from '@texuli/drag/messages';
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { type ClassValue, cx } from 'texuli/cx';
import {
  buildTree,
  type FlatNode,
  flatten,
  indent,
  moveNode,
  moveSibling,
  outdent,
  type TreeMove,
  type TreeMoveResult,
} from '../engines/tree/tree.ts';
import { dropAsChild, placementsOf, type TreePlacement } from './model.ts';
import type { TreeDataViewLabels } from './types.ts';

interface TreeDataViewProps<T> {
  items: readonly T[];
  getId: (item: T) => string;
  getParentId: (item: T) => string | null;
  getRank: (item: T) => string;
  getLabel?: (item: T) => string;
  /** Nodes that still have unloaded children (lazy trees). */
  hasChildren?: (item: T) => boolean;
  /** Fetch children when a lazy parent expands. Host merges rows into `items`. */
  loadChildren?: (item: T) => Promise<readonly T[]>;
  onChildrenLoaded?: (parent: T, children: readonly T[]) => void | Promise<void>;
  onMove?: (move: TreeMove, item: T) => void | Promise<void>;
  selected?: string[];
  onSelectedChange?: (selected: string[]) => void;
  expanded?: string[];
  onExpandedChange?: (expanded: string[]) => void;
  checkboxes?: boolean;
  /** Custom row body; defaults to the item label. */
  item?: Snippet<[T, { pending: boolean; selected: boolean }]>;
  labels?: Partial<TreeDataViewLabels>;
  /** Drag announcements (`@texuli/drag` templates), e.g. a localized `pickedUp`. */
  messages?: DragMessagesOverrides;
  density?: 'comfortable' | 'compact';
  dir?: 'ltr' | 'rtl' | 'auto';
  class?: ClassValue;
}

const DEFAULT_LABELS: TreeDataViewLabels = {
  tree: 'Tree',
  instructions:
    'Arrow keys move focus. Left and Right collapse or expand. Space toggles the checkbox. Alt+Up or Alt+Down reorders among siblings. Alt+Right indents; Alt+Left outdents. Drag the grip to move a row.',
  dragHandle: (label) => `Move ${label}`,
  expand: (label) => `Expand ${label}`,
  collapse: (label) => `Collapse ${label}`,
  checkbox: (label) => `Select ${label}`,
  loadingChildren: 'Loading children',
  loadError: 'Children could not be loaded',
  empty: 'No items',
  savingMove: 'Saving move',
  announcement: (message) => message,
  collapsed: (label) => `Collapsed ${label}.`,
  expanded: (label) => `Expanded ${label}.`,
  moved: (label) => `Moved ${label}.`,
  movedUnder: (label, parent) => `Moved ${label} under ${parent}.`,
  topLevel: 'the top level',
  moveFailed: (label) => `${label} was not moved. It returned to its previous position.`,
};

let {
  items,
  getId,
  getParentId,
  getRank,
  getLabel = (item: T) => getId(item),
  hasChildren,
  loadChildren,
  onChildrenLoaded,
  onMove,
  selected = $bindable<string[]>([]),
  onSelectedChange,
  expanded = $bindable<string[]>([]),
  onExpandedChange,
  checkboxes = true,
  item: itemSnippet,
  labels: labelOverrides,
  messages: messageOverrides,
  density = 'comfortable',
  dir,
  class: className,
}: TreeDataViewProps<T> = $props();

const uid = $props.id();
const instructionsId = `tree-view-${uid}-instructions`;
const titleId = `tree-view-${uid}-title`;
const labels = $derived({ ...DEFAULT_LABELS, ...labelOverrides });
const messages = $derived(resolveDragMessages(messageOverrides));

let pending = $state<Record<string, boolean>>({});
let placements = $state<Record<string, TreePlacement>>({});
let loadingIds = $state(new Set<string>());
let failedIds = $state(new Set<string>());
let activeId = $state<string | undefined>();
let announcement = $state('');
/** The pointer drag in progress (keyboard moves use Alt+Arrow). */
let drag = $state<{
  id: string;
  active: boolean;
  target: { parentId: string | null; index: number } | null;
} | null>(null);
/** True right after a completed drag, so its trailing click stays silent. */
let suppressHandleInstructions = false;

const accessors = $derived({
  id: getId,
  parentId: (item: T) => placements[getId(item)]?.parentId ?? getParentId(item),
  rank: (item: T) => placements[getId(item)]?.rank ?? getRank(item),
});

const tree = $derived(buildTree(items, accessors));
const expandedSet = $derived(new Set(expanded));
const selectedSet = $derived(new Set(selected));

const rows = $derived(
  flatten(tree, {
    expanded: expandedSet,
    hasChildren: (item) => {
      const id = getId(item);
      if (loadingIds.has(id) || failedIds.has(id)) return true;
      return hasChildren?.(item) ?? false;
    },
  })
);

$effect(() => {
  const unresolved = Object.keys(placements).filter((id) => !pending[id]);
  if (unresolved.length === 0) return;
  const byId = new Map(items.map((item) => [getId(item), item]));
  const settled = unresolved.filter((id) => {
    const item = byId.get(id);
    const placement = placements[id];
    if (!item || !placement) return true;
    return getParentId(item) === placement.parentId && getRank(item) === placement.rank;
  });
  if (settled.length === 0) return;
  const next = { ...placements };
  for (const id of settled) delete next[id];
  placements = next;
});

$effect(() => {
  if (rows.length === 0) {
    activeId = undefined;
    return;
  }
  if (activeId && rows.some((row) => row.id === activeId)) return;
  activeId = rows[0]?.id;
});

function announce(message: string | undefined): void {
  if (message) announcement = labels.announcement(message);
}

function emitSelected(next: string[]): void {
  selected = next;
  onSelectedChange?.(next);
}

function emitExpanded(next: string[]): void {
  expanded = next;
  onExpandedChange?.(next);
}

function itemById(id: string): T | undefined {
  return items.find((item) => getId(item) === id);
}

function rowById(id: string): FlatNode<T> | undefined {
  return rows.find((row) => row.id === id);
}

async function focusRow(id: string): Promise<void> {
  await tick();
  const root = document.getElementById(`tree-view-${uid}`);
  const el = root?.querySelector<HTMLElement>(`[data-tree-row-id="${CSS.escape(id)}"]`);
  el?.focus();
}

async function ensureChildren(item: T): Promise<boolean> {
  if (!loadChildren) return true;
  const id = getId(item);
  const kids = tree.children.get(id);
  if ((kids?.length ?? 0) > 0 || loadingIds.has(id)) return true;
  if (!hasChildren?.(item) && (kids?.length ?? 0) === 0) return true;
  if (failedIds.has(id)) return false;

  loadingIds = new Set(loadingIds).add(id);
  try {
    const children = await loadChildren(item);
    await onChildrenLoaded?.(item, children);
    const nextFailed = new Set(failedIds);
    nextFailed.delete(id);
    failedIds = nextFailed;
    return true;
  } catch {
    failedIds = new Set(failedIds).add(id);
    announce(labels.loadError);
    return false;
  } finally {
    const nextLoading = new Set(loadingIds);
    nextLoading.delete(id);
    loadingIds = nextLoading;
  }
}

async function toggleExpanded(row: FlatNode<T>): Promise<void> {
  if (!row.hasChildren || pending[row.id]) return;
  if (row.expanded) {
    emitExpanded(expanded.filter((id) => id !== row.id));
    announce(labels.collapsed(getLabel(row.item)));
    return;
  }
  const ok = await ensureChildren(row.item);
  if (!ok) return;
  if (!expandedSet.has(row.id)) emitExpanded([...expanded, row.id]);
  announce(labels.expanded(getLabel(row.item)));
}

function toggleSelected(id: string): void {
  if (!checkboxes) return;
  if (selectedSet.has(id)) {
    emitSelected(selected.filter((entry) => entry !== id));
  } else {
    emitSelected([...selected, id]);
  }
}

async function commit(move: TreeMove, item: T): Promise<void> {
  if (!onMove) return;
  const nextPlacements = placementsOf(move);
  const oldPlacements = Object.fromEntries(
    Object.keys(nextPlacements).map((id) => [id, placements[id]])
  );
  placements = { ...placements, ...nextPlacements };
  pending = { ...pending, [move.id]: true };
  try {
    await onMove(move, item);
  } catch {
    const restored = { ...placements };
    for (const [id, placement] of Object.entries(oldPlacements)) {
      if (placement) restored[id] = placement;
      else delete restored[id];
    }
    placements = restored;
    announce(labels.moveFailed(getLabel(item)));
  } finally {
    const { [move.id]: _done, ...remaining } = pending;
    pending = remaining;
  }
}

function applyMoveResult(result: TreeMoveResult, item: T, successMessage?: string): void {
  if (!result.ok) {
    announce(result.reason);
    return;
  }
  if (result.unchanged) return;
  if (successMessage) announce(successMessage);
  else announce(labels.moved(getLabel(item)));
  void commit(result.move, item);
}

function moveTo(item: T, target: { parentId: string | null; index: number }): void {
  const result = moveNode(tree, getId(item), target);
  const parentLabel =
    target.parentId === null
      ? labels.topLevel
      : getLabel(itemById(target.parentId) as T) || target.parentId;
  applyMoveResult(result, item, labels.movedUnder(getLabel(item), parentLabel));
}

function onRowKey(event: KeyboardEvent, row: FlatNode<T>): void {
  if (pending[row.id]) return;
  const index = rows.findIndex((entry) => entry.id === row.id);
  const isRtl =
    dir === 'rtl' ||
    (dir !== 'ltr' &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.ownerDocument.defaultView?.getComputedStyle(event.currentTarget)
        .direction === 'rtl');

  const collapseKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
  const expandKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
  // Indent follows the direction that moves a row deeper in reading order,
  // mirroring the collapse/expand flip above.
  const indentKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
  const outdentKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

  const isArrow =
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight';
  // A read-only tree (no onMove) leaves Alt+Arrow to the browser (Alt+Left is
  // Back): no preventDefault, no move, no announcement, no plain-arrow fallback.
  if (event.altKey && isArrow && !onMove) return;
  if (event.altKey && onMove && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    const step = event.key === 'ArrowUp' ? -1 : 1;
    applyMoveResult(moveSibling(tree, row.id, step), row.item);
    void focusRow(row.id);
    return;
  }
  if (event.altKey && onMove && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    const result = event.key === indentKey ? indent(tree, row.id) : outdent(tree, row.id);
    applyMoveResult(result, row.item);
    void focusRow(row.id);
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const next = rows[index + 1];
    if (next) {
      activeId = next.id;
      void focusRow(next.id);
    }
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prev = rows[index - 1];
    if (prev) {
      activeId = prev.id;
      void focusRow(prev.id);
    }
    return;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    const first = rows[0];
    if (first) {
      activeId = first.id;
      void focusRow(first.id);
    }
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    const last = rows[rows.length - 1];
    if (last) {
      activeId = last.id;
      void focusRow(last.id);
    }
    return;
  }
  if (event.key === collapseKey) {
    event.preventDefault();
    if (row.expanded) void toggleExpanded(row);
    else if (row.parentId) {
      activeId = row.parentId;
      void focusRow(row.parentId);
    }
    return;
  }
  if (event.key === expandKey) {
    event.preventDefault();
    if (row.hasChildren && !row.expanded) void toggleExpanded(row);
    else if (row.expanded) {
      const child = rows[index + 1];
      if (child && child.parentId === row.id) {
        activeId = child.id;
        void focusRow(child.id);
      }
    }
    return;
  }
  if (event.key === 'Enter' && row.hasChildren) {
    event.preventDefault();
    void toggleExpanded(row);
    return;
  }
  if ((event.key === ' ' || event.key === 'Spacebar') && checkboxes) {
    event.preventDefault();
    toggleSelected(row.id);
    return;
  }
}

// ── Pointer drag on the shared @texuli/drag engine ─────────────────────────
// The gesture tracker owns the drag lifecycle: the 4 px threshold, capture
// (with a document fallback) and pointercancel. A drop goes through `moveTo`,
// which asks `moveNode` and voices any refusal, like the keyboard path.
// The row rects are measured when the drag starts and re-measured only
// on scroll.

type DropTarget = { parentId: string | null; index: number };

/** Row boxes, measured at drag start and on scroll. */
let rectById = new Map<string, { x: number; y: number; width: number; height: number }>();
let stopWatching: (() => void) | null = null;
/** Where the dragged row started, for the pick-up and cancel announcements. */
let origin: DragMessageValues = {};

function measureRows(): void {
  const root = document.getElementById(`tree-view-${uid}`);
  rectById = new Map(
    [...(root?.querySelectorAll<HTMLElement>('[data-tree-row-id]') ?? [])].map((node) => {
      const box = node.getBoundingClientRect();
      return [
        node.dataset.treeRowId ?? '',
        { x: box.left, y: box.top, width: box.width, height: box.height },
      ];
    })
  );
}

function textDirection(): 'ltr' | 'rtl' {
  const root = document.getElementById(`tree-view-${uid}`);
  return dir === 'rtl' ||
    (dir !== 'ltr' && root?.ownerDocument.defaultView?.getComputedStyle(root).direction === 'rtl')
    ? 'rtl'
    : 'ltr';
}

/**
 * The row under the pointer comes from `elementFromPoint` (the topmost visible
 * row in a scrolled tree); nesting and the sibling index come from the boxes
 * measured at drag start and the engine's midpoint search.
 */
function targetAt(point: Point, movingId: string): DropTarget | null {
  const root = document.getElementById(`tree-view-${uid}`);
  const element = root?.ownerDocument
    .elementFromPoint(point.x, point.y)
    ?.closest<HTMLElement>('[data-tree-row-id]');
  const overId = element && root?.contains(element) ? element.dataset.treeRowId : undefined;
  if (!overId || overId === movingId) return null;
  const over = rowById(overId);
  if (!over) return null;
  const rect = rectById.get(overId) ?? element?.getBoundingClientRect();
  if (rect && dropAsChild(rect.x, rect.width, point.x, textDirection())) {
    return { parentId: overId, index: Number.MAX_SAFE_INTEGER };
  }
  const parentId = over.parentId;
  const middles = (tree.children.get(parentId) ?? [])
    .map((item) => getId(item))
    .filter((id) => id !== movingId)
    .map((id) => rectById.get(id))
    .filter((box) => box !== undefined)
    .map((box) => box.y + box.height / 2);
  return { parentId, index: midpointIndex(middles, point.y) };
}

function startDrag(row: FlatNode<T>, point: Point): void {
  measureRows();
  const doc = document.getElementById(`tree-view-${uid}`)?.ownerDocument;
  if (doc) {
    const onScroll = () => measureRows();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelDrag(true);
    };
    doc.addEventListener('scroll', onScroll, true);
    doc.addEventListener('keydown', onKey, true);
    stopWatching = () => {
      doc.removeEventListener('scroll', onScroll, true);
      doc.removeEventListener('keydown', onKey, true);
    };
  }
  drag = { id: row.id, active: true, target: null };
  const parent = row.parentId === null ? undefined : itemById(row.parentId);
  origin = {
    item: getLabel(row.item),
    position: row.position,
    total: row.siblings,
    container: parent ? getLabel(parent) : labels.topLevel,
  };
  announce(formatDragMessage(messages.pickedUp, origin));
  moveDrag(point);
}

function moveDrag(point: Point): void {
  if (!drag) return;
  const target = targetAt(point, drag.id);
  drag = { ...drag, target };
}

function endDrag(point: Point): void {
  const current = drag;
  if (!current) return;
  // The browser fires a trailing click on the handle after a real drag; the
  // move announcement just made must not be followed by the instructions.
  suppressHandleInstructions = true;
  const target = targetAt(point, current.id) ?? current.target;
  finishDrag();
  const item = itemById(current.id);
  if (!item || !target) return;
  moveTo(item, target);
}

function finishDrag(): void {
  stopWatching?.();
  stopWatching = null;
  drag = null;
}

function cancelDrag(announceIt: boolean): void {
  const wasDragging = drag !== null;
  finishDrag();
  if (announceIt && wasDragging) announce(formatDragMessage(messages.cancelled, origin));
}

/** Pointer drags from a row's grip (keyed by id, so re-renders never re-attach it). */
function dragFrom(id: string): Attachment<HTMLElement> {
  return (node) => {
    let blocked = false;
    const onDown = () => {
      suppressHandleInstructions = false;
      blocked = !onMove || Boolean(pending[id]);
    };
    node.addEventListener('pointerdown', onDown, true);
    const dispose = bindPointerGesture(
      node,
      createPointerTracker({
        onStart: (event) => {
          const row = rowById(id);
          if (!blocked && row) startDrag(row, event.point);
        },
        onMove: (event) => moveDrag(event.point),
        onEnd: (event) => endDrag(event.point),
        onCancel: () => cancelDrag(false),
      }),
      { listenOn: node.closest<HTMLElement>('[data-tree-view]') ?? node }
    );
    return () => {
      node.removeEventListener('pointerdown', onDown, true);
      dispose();
    };
  };
}

/**
 * The grip is pointer-only; assistive tech that activates it gets the keyboard
 * move map instead of silence (the moves themselves stay keyboard-reachable).
 */
function onHandleClick(): void {
  if (suppressHandleInstructions) {
    suppressHandleInstructions = false;
    return;
  }
  announce(labels.instructions);
}

function dropTargetFor(row: FlatNode<T>): boolean {
  if (!drag?.active || !drag.target) return false;
  if (drag.target.parentId === row.id) return true;
  if (drag.target.parentId !== row.parentId) return false;
  const siblings = (tree.children.get(row.parentId) ?? [])
    .map((item) => getId(item))
    .filter((id) => id !== drag?.id);
  const index = siblings.indexOf(row.id);
  return index === drag.target.index || index + 1 === drag.target.index;
}
</script>

<section
  id="tree-view-{uid}"
  class={cx(
    'tx-tree-view',
    density === 'compact' && 'tx-tree-view--compact',
    drag?.active && 'tx-tree-view--dragging',
    className
  )}
  aria-labelledby={titleId}
  dir={dir}
  data-tree-view
>
  <h2 id={titleId} class="tx-tree-view__sr-only">{labels.tree}</h2>
  <p id={instructionsId} class="tx-tree-view__sr-only">{labels.instructions}</p>

  {#if rows.length === 0}
    <p class="tx-tree-view__empty">{labels.empty}</p>
  {:else}
    <ul
      class="tx-tree-view__list"
      role="tree"
      aria-labelledby={titleId}
      aria-describedby={instructionsId}
      aria-multiselectable="true"
    >
      {#each rows as row (row.id)}
        {@const itemLabel = getLabel(row.item)}
        {@const isSelected = selectedSet.has(row.id)}
        {@const isLoading = loadingIds.has(row.id)}
        {@const isFailed = failedIds.has(row.id)}
        {@const isActive = activeId === row.id}
        {@const isDragging = drag?.id === row.id && drag.active}
        <li
          class={cx(
            'tx-tree-view__row',
            isDragging && 'tx-tree-view__row--dragging',
            dropTargetFor(row) && 'tx-tree-view__row--drop-target',
            isSelected && 'tx-tree-view__row--selected'
          )}
          role="treeitem"
          tabindex={isActive ? 0 : -1}
          id="tree-view-{uid}-row-{row.id}"
          data-tree-row-id={row.id}
          data-level={row.level}
          aria-level={row.level}
          aria-posinset={row.position}
          aria-setsize={row.siblings}
          aria-expanded={row.hasChildren ? row.expanded : undefined}
          aria-selected={isSelected}
          aria-busy={isLoading || pending[row.id] ? 'true' : undefined}
          style="--tx-tree-view-depth: {row.level - 1}"
          onfocus={() => (activeId = row.id)}
          onkeydown={(event) => onRowKey(event, row)}
        >
          {#if onMove}
            <button
              class="tx-tree-view__handle"
              type="button"
              tabindex="-1"
              data-tree-handle
              aria-label={labels.dragHandle(itemLabel)}
              disabled={pending[row.id]}
              {@attach dragFrom(row.id)}
              onclick={onHandleClick}
            >
              <span class="tx-tree-view__grip" aria-hidden="true">⠿</span>
            </button>
          {/if}

          {#if checkboxes}
            <button
              class="tx-tree-view__check"
              type="button"
              tabindex="-1"
              data-checked={isSelected ? 'true' : 'false'}
              aria-label={labels.checkbox(itemLabel)}
              aria-pressed={isSelected}
              onclick={(event) => {
                event.stopPropagation();
                toggleSelected(row.id);
              }}
            >
              {#if isSelected}
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"
                  ><path d="m3 8 3.1 3.1L13 4.5" /></svg
                >
              {/if}
            </button>
          {/if}

          {#if row.hasChildren}
            <button
              class="tx-tree-view__twist"
              type="button"
              tabindex="-1"
              data-expanded={row.expanded ? 'true' : 'false'}
              aria-label={row.expanded ? labels.collapse(itemLabel) : labels.expand(itemLabel)}
              disabled={pending[row.id] || isLoading}
              onclick={(event) => {
                event.stopPropagation();
                void toggleExpanded(row);
              }}
            >
              <span class="tx-tree-view__chevron" aria-hidden="true"></span>
            </button>
          {:else}
            <span class="tx-tree-view__twist-spacer" aria-hidden="true"></span>
          {/if}

          <div class="tx-tree-view__content">
            {#if itemSnippet}
              {@render itemSnippet(row.item, {
                pending: pending[row.id] ?? false,
                selected: isSelected,
              })}
            {:else}
              <span class="tx-tree-view__label">{itemLabel}</span>
            {/if}
            {#if isLoading}
              <span class="tx-tree-view__status-inline" role="status">{labels.loadingChildren}</span>
            {/if}
            {#if isFailed}
              <span class="tx-tree-view__status-inline tx-tree-view__status-inline--error" role="status"
                >{labels.loadError}</span
              >
            {/if}
            {#if pending[row.id]}
              <span class="tx-tree-view__status-inline" role="status">{labels.savingMove}</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="tx-tree-view__live" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </p>
</section>

<style>
  @layer tx.components {
    .tx-tree-view {
      color: var(--tx-foreground, var(--tx-text, CanvasText));
      color-scheme: light dark;
      min-inline-size: 0;
    }

    .tx-tree-view__sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .tx-tree-view__list {
      list-style: none;
      margin: 0;
      padding: var(--tx-space-1);
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-xl);
      background: var(--tx-surface, Canvas);
    }

    .tx-tree-view__row {
      display: flex;
      align-items: center;
      gap: var(--tx-space-1);
      min-block-size: 2.75rem;
      padding-block: var(--tx-space-1);
      padding-inline-end: var(--tx-space-2);
      padding-inline-start: calc(var(--tx-tree-view-depth, 0) * var(--tx-space-5));
      border-radius: var(--tx-shape-radius-lg);
      outline: none;
    }

    .tx-tree-view--compact .tx-tree-view__row {
      min-block-size: 2.25rem;
      gap: calc(var(--tx-space-unit) * 0.5);
    }

    .tx-tree-view__row:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-tree-view__row--selected {
      background: color-mix(in srgb, var(--tx-primary, Highlight) 18%, Canvas);
      color: CanvasText;
      outline: 2px solid var(--tx-primary, Highlight);
      outline-offset: -2px;
    }

    .tx-tree-view__row--selected .tx-tree-view__label,
    .tx-tree-view__row--selected .tx-tree-view__content,
    .tx-tree-view__row--selected .tx-tree-view__content :where(*) {
      color: CanvasText;
    }

    .tx-tree-view__row--dragging,
    .tx-tree-view__row--drop-target {
      outline: 2px dashed var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-tree-view__handle,
    .tx-tree-view__check,
    .tx-tree-view__twist {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      inline-size: 2.25rem;
      block-size: 2.25rem;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: var(--tx-shape-radius-md);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .tx-tree-view__handle {
      cursor: grab;
      touch-action: none;
    }

    .tx-tree-view__handle:active {
      cursor: grabbing;
    }

    .tx-tree-view__handle:disabled,
    .tx-tree-view__twist:disabled {
      cursor: wait;
      opacity: 0.6;
    }

    .tx-tree-view__handle:focus-visible,
    .tx-tree-view__check:focus-visible,
    .tx-tree-view__twist:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-tree-view__grip {
      color: var(--tx-muted-foreground, GrayText);
      font-size: var(--tx-type-label-size);
      line-height: 1;
    }

    /* The hit area stays at the shared 2.25rem control size; the drawn box is
       the 1.25rem pseudo-element, so the tap target clears 24px. */
    .tx-tree-view__check {
      position: relative;
      margin-inline: var(--tx-space-1);
    }

    .tx-tree-view__check::before {
      content: '';
      position: absolute;
      inset: 0;
      margin: auto;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-sm);
    }

    .tx-tree-view__check[data-checked='true'] {
      color: var(--tx-primary-foreground, Canvas);
    }

    .tx-tree-view__check[data-checked='true']::before {
      background: var(--tx-primary, Highlight);
      border-color: var(--tx-primary, Highlight);
    }

    .tx-tree-view__check svg {
      position: relative;
      inline-size: 0.875rem;
      block-size: 0.875rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .tx-tree-view__twist-spacer {
      inline-size: 2.25rem;
      block-size: 2.25rem;
      flex: 0 0 auto;
    }

    .tx-tree-view__chevron {
      display: block;
      inline-size: 0.5rem;
      block-size: 0.5rem;
      border-block-end: var(--tx-border-width-thick) solid currentColor;
      border-inline-end: var(--tx-border-width-thick) solid currentColor;
      transform: rotate(-45deg);
      transition: transform 120ms ease;
    }

    .tx-tree-view__twist[data-expanded='true'] .tx-tree-view__chevron {
      transform: rotate(45deg);
    }

    .tx-tree-view__content {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--tx-space-2);
      min-inline-size: 0;
      padding-inline: var(--tx-space-1);
    }

    .tx-tree-view__label {
      font-weight: 500;
    }

    .tx-tree-view__status-inline {
      font-size: 0.8125rem;
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-tree-view__status-inline--error {
      color: var(--tx-danger, CanvasText);
    }

    .tx-tree-view__empty {
      margin: 0;
      padding: var(--tx-space-4);
      border: var(--tx-border-width-thin) dashed var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-lg);
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-tree-view__live {
      min-block-size: 1.5em;
      margin-block: var(--tx-space-2) 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .tx-tree-view__chevron {
        transition: none;
      }
    }

    @media (forced-colors: active) {
      .tx-tree-view__list,
      .tx-tree-view__check,
      .tx-tree-view__empty {
        border-color: CanvasText;
      }
      .tx-tree-view__row--selected {
        background: Highlight;
        color: HighlightText;
        outline-color: CanvasText;
      }
      .tx-tree-view__row--selected .tx-tree-view__label,
      .tx-tree-view__row--selected .tx-tree-view__content,
      .tx-tree-view__row--selected .tx-tree-view__content :where(*) {
        color: HighlightText;
        forced-color-adjust: none;
      }
      .tx-tree-view__check[data-checked='true'] {
        color: HighlightText;
      }
      .tx-tree-view__check[data-checked='true']::before {
        background: Highlight;
        border-color: CanvasText;
      }
    }
  }
</style>
