<script lang="ts">
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { tick } from 'svelte';
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
 * Blueprint outline: an APG single-select tree (focus and selection move
 * together, roving tabindex). Alt+Arrow keys and drag-and-drop both turn
 * into `move` edit ops through the same model, and the host applies them.
 * Labels render as text; rows are never HTML sinks.
 */
let {
  tree,
  selected,
  labelOf,
  canContain,
  onselect,
  onmove,
  onremove,
  label = 'Structure',
}: {
  tree: CatalogTreeInput;
  selected: NodePath;
  labelOf: (id: string) => string;
  canContain: CanContain;
  onselect: (path: number[]) => void;
  /** Apply the op; return a refusal message, or `null` when it was applied. */
  onmove: (op: MoveOp) => string | null;
  onremove: (path: number[]) => void;
  label?: string;
} = $props();

const uid = $props.id();
const rows = $derived(outlineRows(tree, labelOf, canContain));
const selectedKey = $derived(pathKey(selected));
const focusKey = $derived(rows.some((row) => row.key === selectedKey) ? selectedKey : '');

let message = $state('');
let dragKey = $state<string | null>(null);
let dropHint = $state<{ key: string; position: DropPosition } | null>(null);

function rowElement(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-builder-row="${key}"]`);
}

async function focusPath(path: readonly number[]) {
  onselect([...path]);
  await tick();
  rowElement(pathKey(path))?.focus();
}

async function commit(result: MoveResult) {
  if (!result.ok) {
    message = REFUSAL_TEXT[result.reason];
    return;
  }
  const refused = onmove(result.op);
  if (refused) {
    message = refused;
    return;
  }
  const destination = [...result.op.parent, result.op.index];
  await tick();
  message = moveAnnouncement(tree, result.op, labelOf);
  await focusPath(destination);
}

const selectedRow = $derived(rows.find((row) => row.key === selectedKey));

/** Remove a row (never the root) and move focus to its parent. */
async function removeRow(row: (typeof rows)[number]) {
  if (row.path.length === 0) return;
  onremove([...row.path]);
  message = `Removed ${row.label}.`;
  await focusPath(row.path.slice(0, -1));
}

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

function onkeydown(event: KeyboardEvent, index: number) {
  const row = rows[index];
  if (!row) return;
  if (event.key === 'Escape' && dragKey !== null) {
    event.preventDefault();
    ondragend();
    message = 'Move cancelled.';
    return;
  }
  const key = logicalKey(event);
  if (event.altKey && INTENTS[key]) {
    event.preventDefault();
    void commit(keyboardMove(tree, row.path, INTENTS[key] as MoveIntent, canContain));
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (row.path.length === 0) return;
    event.preventDefault();
    void removeRow(row);
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
  if (target) void focusPath(target.path);
}

function ondragstart(event: DragEvent, key: string) {
  dragKey = key;
  message = '';
  event.dataTransfer?.setData('text/plain', key);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function hintFor(event: DragEvent, key: string): { key: string; position: DropPosition } | null {
  const row = rows.find((candidate) => candidate.key === key);
  const from = rows.find((candidate) => candidate.key === dragKey);
  const element = event.currentTarget as HTMLElement | null;
  if (!row || !from || !element) return null;
  const box = element.getBoundingClientRect();
  const position = dropPosition(event.clientY - box.top, box.height, row.canContain);
  return dropMove(tree, from.path, row.path, position, canContain).ok ? { key, position } : null;
}

function ondragover(event: DragEvent, key: string) {
  dropHint = hintFor(event, key);
  if (dropHint) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
}

function ondrop(event: DragEvent, key: string) {
  event.preventDefault();
  const hint = hintFor(event, key);
  const from = rows.find((candidate) => candidate.key === dragKey);
  const target = rows.find((candidate) => candidate.key === key);
  dragKey = null;
  dropHint = null;
  if (!hint || !from || !target) return;
  void commit(dropMove(tree, from.path, target.path, hint.position, canContain));
}

function ondragend() {
  dragKey = null;
  dropHint = null;
}
</script>

<div class="outline" data-tx-outline>
  <p id={`${uid}-hint`} class="outline__hint">
    Arrow keys move through the outline. Alt with an arrow key moves the selected component:
    up, down, into the component above (Alt+Right) or out of its group (Alt+Left). Delete removes
    it. Rows can also be dragged.
  </p>
  <div class="outline__tree" role="tree" aria-label={label} aria-describedby={`${uid}-hint`}>
    {#each rows as row, index (row.key)}
      <div
        class="outline__row"
        style={`--depth: ${row.level - 1}`}
        data-drop={dropHint?.key === row.key ? dropHint.position : undefined}
        role="none"
        ondragover={(event) => ondragover(event, row.key)}
        ondragleave={() => {
          if (dropHint?.key === row.key) dropHint = null;
        }}
        ondrop={(event) => ondrop(event, row.key)}
      >
        <button
          type="button"
          role="treeitem"
          aria-level={row.level}
          aria-setsize={row.siblings}
          aria-posinset={row.position}
          aria-expanded={row.childCount > 0 ? 'true' : undefined}
          aria-selected={selectedKey === row.key}
          tabindex={focusKey === row.key ? 0 : -1}
          data-builder-row={row.key}
          class:outline__item--selected={selectedKey === row.key}
          class:outline__item--dragging={dragKey === row.key}
          draggable={row.path.length > 0 ? 'true' : undefined}
          onclick={() => onselect([...row.path])}
          onkeydown={(event) => onkeydown(event, index)}
          ondragstart={(event) => ondragstart(event, row.key)}
          {ondragend}
        >
          {row.label}
          {#if selectedKey === row.key}<span class="outline__selected-label">Selected</span>{/if}
        </button>
      </div>
    {/each}
  </div>
  <!-- Outside the tree: a tree may only own treeitems (APG, aria-required-children). -->
  <button
    class="outline__remove"
    type="button"
    disabled={!selectedRow || selectedRow.path.length === 0}
    onclick={() => {
      if (selectedRow) void removeRow(selectedRow);
    }}
  >
    {selectedRow && selectedRow.path.length > 0 ? `Remove ${selectedRow.label}` : 'Remove selected component'}
  </button>
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
  }
  .outline__item--dragging {
    opacity: 0.6;
  }
  .outline__selected-label {
    float: inline-end;
    font-size: 0.75rem;
  }
  .outline__remove {
    font-size: 0.8rem;
  }
  @media (forced-colors: active) {
    .outline__row[data-drop] {
      border-color: Highlight;
      outline-color: Highlight;
    }
  }
</style>
