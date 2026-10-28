<script lang="ts">
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { createDragSession, type Point } from '@texuli/drag';
import { type Droppable, pointerWithin } from '@texuli/drag/collision';
import { bindPointerGesture, createPointerTracker } from '@texuli/drag/gesture';
import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import {
  GROUP_REFUSAL_TEXT,
  type GroupResult,
  groupDropMove,
  groupKeyboardMove,
  groupName,
  groupRoots,
  parseKey,
  rangeKeys,
  toggleKey,
} from './group.ts';
import {
  type CanContain,
  type DropPosition,
  dropMove,
  dropPosition,
  keyboardMove,
  type MoveIntent,
  type MoveOp,
  type MoveResult,
  moveAnnouncement,
  type NodePath,
  outlineRows,
  pathKey,
  REFUSAL_TEXT,
} from './model.ts';

/**
 * Blueprint outline: an APG multi-select tree (roving tabindex; plain
 * arrows move focus and selection together, Shift and Ctrl/Cmd extend the
 * selection). Alt+Arrow keys and pointer drags both turn into `move` edit
 * ops through the same model, for one row or the whole selection, and the
 * host applies them behind its structure guard. Pointer drags run on the
 * shared `@texuli/drag` engine (gesture tracker, drag session, collision on
 * rects snapshotted at drag start); the outline model decides placement.
 * Labels render as text; rows are never HTML sinks.
 */
let {
  tree,
  selected,
  selection = [pathKey(selected)],
  labelOf,
  canContain,
  canPaste = false,
  onselect,
  onselectionchange = () => {},
  onmove,
  onremove,
  oncopy = () => '',
  onduplicate = () => ({ ok: false, message: '' }),
  onpaste = () => ({ ok: false, message: '' }),
  label = 'Structure',
}: {
  tree: CatalogTreeInput;
  /** The focused row: the inspector's node and the tree's tab stop. */
  selected: NodePath;
  /** Every selected row, as path keys. */
  selection?: readonly string[];
  labelOf: (id: string) => string;
  canContain: CanContain;
  /** Whether the host holds copied subtrees. */
  canPaste?: boolean;
  onselect: (path: number[]) => void;
  /** A multi-selection change: the row keys and the row that keeps focus. */
  onselectionchange?: (keys: string[], focus: number[]) => void;
  /** Apply the ops as one step; return a refusal message, or `null` when applied. */
  onmove: (ops: MoveOp[]) => string | null;
  onremove: (paths: number[][]) => void;
  /** Copy the subtrees; return the announcement. */
  oncopy?: (paths: number[][]) => string;
  onduplicate?: (paths: number[][]) => { ok: boolean; message: string };
  /** Paste at (inside or after) the focused row. */
  onpaste?: (at: number[]) => { ok: boolean; message: string };
  label?: string;
} = $props();

const uid = $props.id();
const rows = $derived(outlineRows(tree, labelOf, canContain));
const rowKeys = $derived(rows.map((row) => row.key));
const selectedKey = $derived(pathKey(selected));
const focusKey = $derived(rows.some((row) => row.key === selectedKey) ? selectedKey : '');
const selectedSet = $derived(new Set(selection.filter((key) => rowKeys.includes(key))));
/** What a group action acts on: the selection, or the focused row when nothing is selected. */
const actionPaths = $derived(
  selectedSet.size > 0 ? [...selectedSet].map(parseKey) : [[...selected]]
);
const actionRoots = $derived(groupRoots(actionPaths));

let message = $state('');
let anchorKey = $state<string | null>(null);
let dragKey = $state<string | null>(null);
let dropHint = $state<{ key: string; position: DropPosition; refused: string | null } | null>(null);
let suppressClick = false;
let treeElement = $state<HTMLElement | null>(null);

function rowElement(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-builder-row="${key}"]`);
}

async function focusPath(path: readonly number[]) {
  onselect([...path]);
  await tick();
  rowElement(pathKey(path))?.focus();
}

async function focusOnly(path: readonly number[]) {
  await tick();
  rowElement(pathKey(path))?.focus();
}

/** Select rows without moving the anchor; focus goes to `focus`. */
function setSelection(keys: string[], focus: readonly number[]) {
  onselectionchange(keys, [...focus]);
  void focusOnly(focus);
}

/** The paths a move acts on: the group when the moving row is part of a multi-selection. */
function movingPaths(key: string): number[][] {
  return selectedSet.size > 1 && selectedSet.has(key) ? actionRoots : [parseKey(key)];
}

/** One node's MoveResult or a group's GroupResult, as ops plus where they end up. */
function asGroup(result: MoveResult | GroupResult<MoveOp>): GroupResult<MoveOp> {
  if (!result.ok) return result;
  if ('ops' in result) return result;
  return { ok: true, ops: [result.op], paths: [[...result.op.parent, result.op.index]] };
}

function refusalText(result: GroupResult<MoveOp>, group: boolean): string {
  if (result.ok) return '';
  if (result.reason === 'empty-clipboard') return GROUP_REFUSAL_TEXT[result.reason];
  return group ? GROUP_REFUSAL_TEXT[result.reason] : REFUSAL_TEXT[result.reason];
}

async function commit(result: GroupResult<MoveOp>, group: boolean) {
  if (!result.ok) {
    message = refusalText(result, group);
    return;
  }
  const refused = onmove(result.ops);
  if (refused) {
    message = refused;
    return;
  }
  await tick();
  const first = result.ops[0];
  if (!group && first) {
    message = moveAnnouncement(tree, first, labelOf);
    await focusPath([...first.parent, first.index]);
    return;
  }
  message = `Moved ${result.paths.length} components.`;
  setSelection(
    result.paths.map((path) => pathKey(path)),
    result.paths[0] ?? []
  );
}

function keyboardIntent(row: (typeof rows)[number], intent: MoveIntent) {
  const paths = movingPaths(row.key);
  if (paths.length > 1) {
    void commit(groupKeyboardMove(tree, paths, intent, canContain), true);
  } else {
    void commit(asGroup(keyboardMove(tree, row.path, intent, canContain)), false);
  }
}

const selectedRow = $derived(rows.find((row) => row.key === selectedKey));
const removable = $derived(actionRoots.length > 0);
const actionName = $derived(groupName(tree, actionRoots, labelOf));

/** Remove the selected rows (never the root) and move focus to the first one's parent. */
async function removeRows() {
  const roots = actionRoots;
  if (roots.length === 0) return;
  const name = groupName(tree, roots, labelOf);
  const parent = roots[0]?.slice(0, -1) ?? [];
  onremove(roots);
  message = `Removed ${name}.`;
  await focusPath(parent);
}

function copyRows() {
  if (actionRoots.length === 0) {
    message = 'The page root cannot be copied; select the components to copy.';
    return;
  }
  message = oncopy(actionRoots);
}

async function placeRows(outcome: { ok: boolean; message: string }) {
  message = outcome.message;
  if (outcome.ok) await focusOnly(selected);
}

const duplicateRows = () => {
  if (actionRoots.length === 0) {
    message = 'The page root cannot be duplicated.';
    return;
  }
  void placeRows(onduplicate(actionRoots));
};
const pasteRows = () => void placeRows(onpaste([...selected]));

const INTENTS: Readonly<Record<string, MoveIntent>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'indent',
  ArrowLeft: 'outdent',
};

/**
 * The key as a left-to-right tree reads it: in a right-to-left layout the
 * horizontal arrows swap (WAI-ARIA tree pattern), so ArrowLeft expands,
 * enters and indents, and ArrowRight goes to the parent and outdents.
 */
function logicalKey(event: KeyboardEvent): string {
  const element = event.currentTarget;
  const rtl = element instanceof Element && getComputedStyle(element).direction === 'rtl';
  if (!rtl) return event.key;
  if (event.key === 'ArrowLeft') return 'ArrowRight';
  if (event.key === 'ArrowRight') return 'ArrowLeft';
  return event.key;
}

/** Ctrl/Cmd shortcuts on a row: select all, copy, paste and duplicate. */
function commandKey(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  const key = event.key.toLowerCase();
  if (key === 'a') setSelection([...rowKeys], selected);
  else if (key === 'c') copyRows();
  else if (key === 'v') pasteRows();
  else if (key === 'd') duplicateRows();
  else return false;
  event.preventDefault();
  return true;
}

function onkeydown(event: KeyboardEvent, index: number) {
  const row = rows[index];
  if (!row) return;
  if (event.key === 'Escape' && dragKey !== null) {
    event.preventDefault();
    cancelDrag();
    message = 'Move cancelled.';
    return;
  }
  if (event.key === 'Escape' && selectedSet.size > 1) {
    event.preventDefault();
    anchorKey = row.key;
    setSelection([row.key], row.path);
    message = 'Selection cleared.';
    return;
  }
  if (commandKey(event)) return;
  const key = logicalKey(event);
  if (event.altKey && INTENTS[key]) {
    event.preventDefault();
    keyboardIntent(row, INTENTS[key] as MoveIntent);
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (!removable) return;
    event.preventDefault();
    void removeRows();
    return;
  }
  if (event.key === ' ') {
    // Space toggles the row; Shift+Space selects from the anchor (the data grid's rule).
    event.preventDefault();
    if (event.shiftKey)
      setSelection(rangeKeys(rowKeys, anchorKey ?? selectedKey, row.key), row.path);
    else {
      anchorKey = row.key;
      setSelection(toggleKey([...selectedSet], row.key), row.path);
    }
    return;
  }
  let target: (typeof rows)[number] | undefined;
  if (key === 'ArrowDown') target = rows[index + 1];
  else if (key === 'ArrowUp') target = rows[index - 1];
  else if (key === 'Home') target = rows[0];
  else if (key === 'End') target = rows[rows.length - 1];
  else if (key === 'ArrowRight' && row.childCount > 0) target = rows[index + 1];
  else if (key === 'ArrowLeft' && row.path.length > 0) {
    target = rows.find((candidate) => candidate.key === pathKey(row.path.slice(0, -1)));
  } else return;
  event.preventDefault();
  if (!target) return;
  if (event.shiftKey && (key === 'ArrowDown' || key === 'ArrowUp')) {
    // Shift+Arrow extends the selection from the anchor to the next row.
    setSelection(rangeKeys(rowKeys, anchorKey ?? row.key, target.key), target.path);
    if (anchorKey === null) anchorKey = row.key;
    return;
  }
  anchorKey = target.key;
  void focusPath(target.path);
}

/** Click selects one row; Ctrl/Cmd+click toggles it; Shift+click selects the range from the anchor. */
function onrowclick(event: MouseEvent, row: (typeof rows)[number]) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (event.shiftKey) {
    setSelection(rangeKeys(rowKeys, anchorKey ?? selectedKey, row.key), row.path);
    return;
  }
  anchorKey = row.key;
  if (event.ctrlKey || event.metaKey) setSelection(toggleKey([...selectedSet], row.key), row.path);
  else onselect([...row.path]);
}

// ── Pointer drag (mouse, pen and touch through the handle) ───────────────

/** Structural guard results per drop target, for the drag in progress. */
let checked = new Map<string, string | null>();

/** Why a drop of the dragged rows at `key`/`position` is refused, or `null` when it is allowed. */
function dropRefusal(key: string, position: DropPosition): string | null {
  const cacheKey = `${key}:${position}`;
  const cached = checked.get(cacheKey);
  if (cached !== undefined) return cached;
  const target = rows.find((candidate) => candidate.key === key);
  if (!target || dragKey === null) return REFUSAL_TEXT.missing;
  const paths = movingPaths(dragKey);
  const group = paths.length > 1;
  const result = group
    ? groupDropMove(tree, paths, target.path, position, canContain)
    : asGroup(dropMove(tree, parseKey(dragKey), target.path, position, canContain));
  const refused = result.ok ? null : refusalText(result, group);
  checked.set(cacheKey, refused);
  return refused;
}

interface DropTarget {
  key: string;
  position: DropPosition;
}

/** The engine's session: a refusal's reason is the text the outline announces. */
const session = createDragSession<string, DropTarget>({
  // The pointer tracker applies the 4 px threshold before the session starts.
  threshold: 0,
  canDrop: (_source, target) => {
    const refused = dropRefusal(target.key, target.position);
    return refused === null ? { ok: true } : { ok: false, reason: refused };
  },
});

/** Row rects, snapshotted when a drag starts and re-measured only on scroll. */
let rowRects: Droppable[] = [];
let stopScrollWatch: (() => void) | null = null;

function measureRows() {
  rowRects = [...(treeElement?.querySelectorAll<HTMLElement>('[data-outline-row]') ?? [])].map(
    (element) => {
      const box = element.getBoundingClientRect();
      return {
        id: element.dataset.outlineRow ?? '',
        rect: { x: box.left, y: box.top, width: box.width, height: box.height },
      };
    }
  );
}

function hintAt(point: Point) {
  const hit = pointerWithin({ pointer: point, droppables: rowRects });
  const row = hit && rows.find((candidate) => candidate.key === hit.id);
  const rect = hit && rowRects.find((entry) => entry.id === hit.id)?.rect;
  if (!row || !rect) return null;
  const position = dropPosition(point.y - rect.y, rect.height, row.canContain);
  return { key: row.key, position, refused: dropRefusal(row.key, position) };
}

function startDrag(key: string, point: Point) {
  dragKey = key;
  checked = new Map();
  message = '';
  measureRows();
  const doc = treeElement?.ownerDocument;
  if (doc) {
    const onScroll = () => measureRows();
    doc.addEventListener('scroll', onScroll, true);
    stopScrollWatch = () => doc.removeEventListener('scroll', onScroll, true);
  }
  session.start(key, point, 'pointer');
  moveDrag(point);
}

function moveDrag(point: Point) {
  if (dragKey === null) return;
  session.move(point);
  dropHint = hintAt(point);
  session.over(dropHint ? { key: dropHint.key, position: dropHint.position } : null);
}

function endDrag(point: Point) {
  const from = dragKey;
  if (from === null) return;
  // The click that follows a drag must not reselect the dragged row.
  suppressClick = true;
  moveDrag(point);
  const target = dropHint && rows.find((candidate) => candidate.key === dropHint?.key);
  const position = dropHint?.position;
  const outcome = session.drop();
  cancelDrag();
  if (outcome.kind === 'cancel') {
    // Refused visibly: the reason is announced and the tree is unchanged.
    message =
      outcome.reason === 'no-target'
        ? 'Dropped outside the outline. Nothing moved.'
        : outcome.reason;
    return;
  }
  if (outcome.kind !== 'drop' || !target || !position) return;
  const paths = movingPaths(from);
  if (paths.length > 1) {
    void commit(groupDropMove(tree, paths, target.path, position, canContain), true);
  } else {
    void commit(asGroup(dropMove(tree, parseKey(from), target.path, position, canContain)), false);
  }
}

function cancelDrag() {
  session.cancel();
  stopScrollWatch?.();
  stopScrollWatch = null;
  dragKey = null;
  dropHint = null;
  checked = new Map();
}

/** Pointer drags from a row or its handle: capture with a document fallback, a 4 px threshold, pointercancel cancels. */
function dragFrom(key: string): Attachment<HTMLElement> {
  return (node) =>
    bindPointerGesture(
      node,
      createPointerTracker({
        onStart: (event) => startDrag(key, event.point),
        onMove: (event) => moveDrag(event.point),
        onEnd: (event) => endDrag(event.point),
        onCancel: () => {
          if (dragKey !== null) message = 'Move cancelled.';
          cancelDrag();
        },
      })
    );
}
</script>

<div class="outline" data-tx-outline>
  <p id={`${uid}-hint`} class="outline__hint">
    Arrow keys move through the outline. Alt with an arrow key moves the selected components:
    up, down, into the component above (Alt+Right) or out of their group (Alt+Left). Space or
    Control-click adds a row to the selection, Shift extends it. Control or Command with C, V or D
    copies, pastes or duplicates. Delete removes. Rows can also be dragged.
  </p>
  <div
    class="outline__tree"
    role="tree"
    aria-label={label}
    aria-multiselectable="true"
    aria-describedby={`${uid}-hint`}
    bind:this={treeElement}
  >
    {#each rows as row, index (row.key)}
      <div
        class="outline__row"
        style={`--depth: ${row.level - 1}`}
        data-outline-row={row.key}
        data-drop={dropHint?.key === row.key ? dropHint.position : undefined}
        data-drop-refused={dropHint?.key === row.key && dropHint.refused ? '' : undefined}
        role="none"
      >
        {#if row.path.length > 0}
          <!-- Pointer-only drag handle (touch drags start here); keyboards use Alt+Arrow. -->
          <span
            class="outline__handle"
            aria-hidden="true"
            onpointerdown={() => (suppressClick = false)}
            {@attach dragFrom(row.key)}
          >⠿</span>
        {/if}
        <button
          type="button"
          role="treeitem"
          aria-level={row.level}
          aria-setsize={row.siblings}
          aria-posinset={row.position}
          aria-expanded={row.childCount > 0 ? 'true' : undefined}
          aria-selected={selectedSet.has(row.key)}
          tabindex={focusKey === row.key ? 0 : -1}
          data-builder-row={row.key}
          class:outline__item--selected={selectedSet.has(row.key)}
          class:outline__item--focused={selectedKey === row.key}
          class:outline__item--dragging={dragKey !== null && movingPaths(dragKey).some((path) => pathKey(path) === row.key)}
          onclick={(event) => onrowclick(event, row)}
          onkeydown={(event) => onkeydown(event, index)}
          onpointerdown={() => (suppressClick = false)}
          {@attach row.path.length > 0 && dragFrom(row.key)}
        >
          {row.label}
          {#if selectedSet.has(row.key)}<span class="outline__selected-label">Selected</span>{/if}
        </button>
      </div>
    {/each}
  </div>
  {#if dragKey !== null && dropHint?.refused}
    <p class="outline__drop-refusal" data-outline-drop-refusal>{dropHint.refused}</p>
  {/if}
  <!-- Outside the tree: a tree may only own treeitems (APG, aria-required-children). -->
  <div class="outline__actions">
    <button class="outline__remove" type="button" disabled={!removable} onclick={() => void removeRows()}>
      {removable ? `Remove ${actionName}` : 'Remove selected component'}
    </button>
    <button type="button" disabled={!removable} aria-keyshortcuts="Control+D Meta+D" onclick={duplicateRows}>
      Duplicate
    </button>
    <button type="button" disabled={!removable} aria-keyshortcuts="Control+C Meta+C" onclick={copyRows}>
      Copy
    </button>
    <button type="button" disabled={!canPaste || !selectedRow} aria-keyshortcuts="Control+V Meta+V" onclick={pasteRows}>
      Paste
    </button>
  </div>
  <p class="outline__status" role="status" aria-live="polite" data-outline-status>{message}</p>
</div>

<style>
  .outline {
    display: grid;
    gap: 0.5rem;
  }
  .outline__hint,
  .outline__status {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
  .outline__status:empty {
    display: none;
  }
  .outline__tree {
    display: grid;
    gap: 0.3rem;
  }
  .outline__row {
    display: flex;
    gap: 0.35rem;
    padding-inline-start: calc(var(--depth) * 1rem);
    border-block: 2px solid transparent;
    border-radius: 0.4rem;
  }
  .outline__row[data-drop='before'] {
    border-block-start-color: var(--tx-ring, Highlight);
  }
  .outline__row[data-drop='after'] {
    border-block-end-color: var(--tx-ring, Highlight);
  }
  .outline__row[data-drop='inside'] {
    outline: 2px dashed var(--tx-ring, Highlight);
  }
  .outline__row[data-drop-refused] {
    border-color: transparent;
    outline: 2px dotted var(--tx-destructive, Mark);
    cursor: not-allowed;
  }
  .outline__handle {
    display: grid;
    place-items: center;
    inline-size: 1.5rem;
    color: var(--tx-muted-foreground, GrayText);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .outline__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .outline__drop-refusal {
    margin: 0;
    color: var(--tx-destructive, CanvasText);
    font-size: 0.875rem;
  }
  .outline button {
    font: inherit;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.45rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .outline button:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .outline__row [role='treeitem'] {
    flex: 1;
    text-align: start;
  }
  .outline__item--selected {
    border-color: var(--tx-primary, Highlight) !important;
    background: color-mix(in oklch, var(--tx-primary, Highlight) 10%, var(--tx-surface, Canvas));
  }
  .outline__item--focused {
    border-width: 2px;
  }
  .outline__item--dragging {
    opacity: 0.6;
  }
  .outline__selected-label {
    float: inline-end;
    font-size: 0.75rem;
  }
  .outline__actions button {
    font-size: 0.8rem;
  }
  @media (forced-colors: active) {
    .outline__row[data-drop] {
      border-color: Highlight;
      outline-color: Highlight;
    }
    .outline__row[data-drop-refused] {
      outline-color: Mark;
    }
  }
</style>
