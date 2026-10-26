<script lang="ts" generics="T">
import { lazyChunk } from '@texuli/core/lazy';
import { tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import type { GridValue } from '../engines/grid/columns.ts';
import { DataGrid, type DataGridLabels } from '../grid-core/index.ts';
import { parseClipboard, pastePlan, serializeClipboard } from './clipboard.ts';
import { type GridEditingLabelOverrides, resolveGridEditingLabels } from './labels.ts';
import {
  cellKey,
  displayCellText,
  draftFromValue,
  type EditableColumn,
  type EditorDraft,
  resolveCellValue,
  validateCell,
  valuesEqual,
} from './model.ts';
import { createUndoStack, type UndoStack } from './undo.ts';
import './grid-editing.css';

interface Props {
  rows: readonly T[];
  columns: readonly EditableColumn<T>[];
  getRowId: (row: T) => string;
  caption: string;
  captionHidden?: boolean;
  /**
   * Persist one cell. May return a promise. On rejection the cell rolls back
   * and shows the error message. Hosts usually update `rows` on success.
   */
  onCommit: (row: T, columnKey: string, value: GridValue) => void | Promise<void>;
  /**
   * Apply an undo/redo value onto the host data (required for the undo toolbar
   * to update visible rows when the host owns the array).
   */
  onApply?: (rowId: string, columnKey: string, value: GridValue) => void;
  searchable?: boolean;
  selectable?: boolean;
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  density?: 'compact' | 'default' | 'comfortable';
  /**
   * Render only the rows in view once more than this many are visible
   * (default 1000). Edits, the active cell and focus survive windowing.
   */
  virtualizeAbove?: number;
  /** Estimated row height in px while windowing. */
  rowSize?: number;
  /** Scroll area height in px while windowing. */
  viewportHeight?: number;
  /** Extra rows rendered above and below the view while windowing. */
  overscanRows?: number;
  labels?: Partial<DataGridLabels> & GridEditingLabelOverrides;
  /** External undo stack (tests). Default: an internal stack of 50. */
  undoStack?: UndoStack;
  class?: ClassValue;
}

let {
  rows,
  columns,
  getRowId,
  caption,
  captionHidden = false,
  onCommit,
  onApply,
  searchable = false,
  selectable = false,
  selected = $bindable([]),
  onSelectionChange,
  density = 'default',
  virtualizeAbove = 1000,
  rowSize = 36,
  viewportHeight = 360,
  overscanRows = 4,
  labels,
  undoStack: undoStackProp,
  class: className,
}: Props = $props();

const editText = $derived(resolveGridEditingLabels(labels));
const gridLabels = $derived({
  ...labels,
  instructions:
    typeof labels?.instructions === 'string'
      ? `${labels.instructions} ${editText.editInstructions}`
      : editText.editInstructions,
});

/** Owned stack when the host does not pass one (created once per mount). */
const ownedStack = createUndoStack();
const stack = $derived(undoStackProp ?? ownedStack);
/** Bumps when the undo stack changes so the toolbar can re-render. */
let stackEpoch = $state(0);
const canUndo = $derived.by(() => {
  void stackEpoch;
  return stack.canUndo();
});
const canRedo = $derived.by(() => {
  void stackEpoch;
  return stack.canRedo();
});
let editing = $state<{ rowId: string; key: string; draft: EditorDraft } | null>(null);
let optimistic = $state<Record<string, GridValue>>({});
let pending = $state<Record<string, true>>({});
let errors = $state<Record<string, string>>({});
let announce = $state('');
let CellEditor = $state<typeof import('./CellEditor.svelte').default<T> | null>(null);
let root: HTMLDivElement | undefined = $state();
/** Last focused body cell (row id + column key). */
let focusCell = $state<{ rowId: string; columnKey: string } | null>(null);

function touchStack(): void {
  stackEpoch += 1;
}

function rowById(id: string): T | undefined {
  return rows.find((row) => getRowId(row) === id);
}

function columnByKey(key: string): EditableColumn<T> | undefined {
  return columns.find((column) => column.key === key);
}

/**
 * Focus the open editor and hold the width it opened with (physical, as
 * `offsetWidth` measures it). In a windowed grid the auto-sized columns follow
 * the rows in view, so scrolling would resize the editor, and WebKit then
 * scrolls the focused field's caret back into view, undoing the scroll (the
 * far rows never render).
 */
function focusEditor(): void {
  void tick().then(() => {
    const editor = root?.querySelector<HTMLElement>('[data-tx-grid-editor]');
    if (!editor) return;
    editor.style.width = `${editor.offsetWidth}px`;
    editor.focus();
  });
}

function startEdit(row: T, column: EditableColumn<T>): void {
  if (!column.editable) return;
  const id = getRowId(row);
  const value = resolveCellValue(row, column, id, optimistic);
  const draft = draftFromValue(column, value, row);
  const open = () => {
    editing = { rowId: id, key: column.key, draft };
    focusCell = { rowId: id, columnKey: column.key };
    focusEditor();
  };
  if (CellEditor) {
    open();
    return;
  }
  void lazyChunk('data:grid:cell-editor', () => import('./CellEditor.svelte')).then(
    (mod) => {
      CellEditor = mod.default as typeof CellEditor;
      open();
    },
    () => {
      announce = editText.editorCouldNotLoad;
    }
  );
}

async function commitEdit(row: T, column: EditableColumn<T>): Promise<void> {
  const current = editing;
  if (!current || current.rowId !== getRowId(row) || current.key !== column.key) return;
  editing = null;

  const id = getRowId(row);
  const key = cellKey(id, column.key);
  const checked = validateCell(column, row, current.draft, editText);
  if (!checked.ok) {
    errors = { ...errors, [key]: checked.message };
    announce = editText.notSaved(column.header, checked.message);
    return;
  }

  const previous = resolveCellValue(row, column, id, optimistic);
  if (valuesEqual(column.type, checked.value, previous)) {
    const { [key]: _e, ...rest } = errors;
    errors = rest;
    return;
  }

  optimistic = { ...optimistic, [key]: checked.value };
  pending = { ...pending, [key]: true };
  const { [key]: _old, ...restErr } = errors;
  errors = restErr;

  try {
    await onCommit(row, column.key, checked.value);
    stack.push({ rowId: id, columnKey: column.key, previous, next: checked.value });
    touchStack();
    const { [key]: _v, ...restOpt } = optimistic;
    optimistic = restOpt;
    announce = editText.saved;
  } catch (cause) {
    const message =
      cause instanceof Error && cause.message
        ? cause.message
        : editText.notSaved(column.header, 'Not saved.');
    const { [key]: _v, ...restOpt } = optimistic;
    optimistic = restOpt;
    errors = { ...errors, [key]: message };
    announce = editText.notSaved(column.header, message);
  } finally {
    const { [key]: _p, ...restPending } = pending;
    pending = restPending;
  }
}

function onEditorKey(event: KeyboardEvent, row: T, column: EditableColumn<T>): void {
  event.stopPropagation();
  if (event.key === 'Escape') editing = null;
  else if (event.key === 'Enter') void commitEdit(row, column);
  else return;
  event.preventDefault();
  // Closing from the keyboard returns focus to the cell once the editor is gone.
  const gridcell = (event.target as HTMLElement).closest<HTMLElement>('[role=gridcell]');
  void tick().then(() => gridcell?.focus());
}

function rememberFocus(event: FocusEvent): void {
  const target = event.target as HTMLElement | null;
  // Arrow keys focus the gridcell, which holds the edit cell.
  const host = (target?.closest?.('[data-tx-edit-cell]') ??
    target?.querySelector?.('[data-tx-edit-cell]')) as HTMLElement | null;
  if (!host) return;
  const rowId = host.getAttribute('data-row-id');
  const columnKey = host.getAttribute('data-column-key');
  if (rowId && columnKey) focusCell = { rowId, columnKey };
}

function focusedEditable(): { row: T; column: EditableColumn<T>; colIndex: number } | null {
  if (!focusCell) return null;
  const { rowId, columnKey } = focusCell;
  const row = rowById(rowId);
  const colIndex = columns.findIndex((c) => c.key === columnKey);
  const column = columns[colIndex];
  return row && column ? { row, column, colIndex } : null;
}

function handleCaptureKeydown(event: KeyboardEvent): void {
  if (editing) return;
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (mod && key === 'z' && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    void runHistory(false);
    return;
  }
  if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
    event.preventDefault();
    event.stopPropagation();
    void runHistory(true);
    return;
  }

  const cell = focusedEditable();
  if (!cell) return;

  if ((event.key === 'F2' || event.key === 'Enter') && cell.column.editable) {
    // Stop DataGrid's Enter → onRowActivate when we handle edit.
    event.preventDefault();
    event.stopPropagation();
    startEdit(cell.row, cell.column);
    return;
  }

  if (mod && key === 'c') {
    event.preventDefault();
    event.stopPropagation();
    const text = displayCellText(cell.row, cell.column, getRowId(cell.row), optimistic);
    void navigator.clipboard?.writeText(serializeClipboard([[text]]));
    return;
  }

  if (mod && key === 'v') {
    event.preventDefault();
    event.stopPropagation();
    void pasteAt(cell);
  }
}

async function pasteAt(anchor: {
  row: T;
  column: EditableColumn<T>;
  colIndex: number;
}): Promise<void> {
  let text = '';
  try {
    text = (await navigator.clipboard?.readText()) ?? '';
  } catch {
    return;
  }
  if (!text) return;
  const block = parseClipboard(text);
  const plans = pastePlan(block);
  const anchorRowIndex = rows.findIndex((row) => getRowId(row) === getRowId(anchor.row));
  if (anchorRowIndex < 0) return;

  let written = 0;
  for (const plan of plans) {
    const row = rows[anchorRowIndex + plan.rowOffset];
    const column = columns[anchor.colIndex + plan.colOffset];
    if (!row || !column?.editable) continue;
    const checked = validateCell(column, row, plan.value, editText);
    if (!checked.ok) {
      errors = {
        ...errors,
        [cellKey(getRowId(row), column.key)]: checked.message,
      };
      continue;
    }
    const previous = resolveCellValue(row, column, getRowId(row), optimistic);
    if (valuesEqual(column.type, checked.value, previous)) continue;
    try {
      await onCommit(row, column.key, checked.value);
      stack.push({
        rowId: getRowId(row),
        columnKey: column.key,
        previous,
        next: checked.value,
      });
      touchStack();
      written += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Not saved.';
      errors = { ...errors, [cellKey(getRowId(row), column.key)]: message };
    }
  }
  // A paste changes many cells at once; the live region names the result.
  if (written > 0) announce = editText.pasted(written);
}

/** Undo (or redo) the last edit and write it back through the host. */
async function runHistory(redo: boolean): Promise<void> {
  const op = redo ? stack.redo() : stack.undo();
  if (!op) return;
  touchStack();
  const value = redo ? op.next : op.previous;
  onApply?.(op.rowId, op.columnKey, value);
  const row = rowById(op.rowId);
  if (row && columnByKey(op.columnKey) && !onApply) {
    try {
      await onCommit(row, op.columnKey, value);
    } catch {
      if (redo) stack.undo();
      else stack.redo();
      touchStack();
      return;
    }
  }
  announce = redo ? editText.redo : editText.undo;
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- Keyboard shortcuts are handled on the wrapper; the grid inside remains the focus target. -->
<div
  bind:this={root}
  class={cx('tx-grid-edit', className)}
  data-tx-grid-editing
  role="presentation"
  onfocusin={rememberFocus}
  onkeydown={handleCaptureKeydown}
>
  <div class="tx-grid-edit__toolbar">
    <button type="button" disabled={!canUndo} onclick={() => runHistory(false)}>
      {editText.undo}
    </button>
    <button type="button" disabled={!canRedo} onclick={() => runHistory(true)}>
      {editText.redo}
    </button>
  </div>

  <DataGrid
    {rows}
    {columns}
    {getRowId}
    {caption}
    {captionHidden}
    {searchable}
    {selectable}
    bind:selected
    {onSelectionChange}
    {density}
    {virtualizeAbove}
    {rowSize}
    {viewportHeight}
    {overscanRows}
    editable
    labels={gridLabels}
  >
    {#snippet cell(row, column)}
      {@const editable = column as EditableColumn<T>}
      {@const id = getRowId(row)}
      {@const key = cellKey(id, editable.key)}
      {@const isEditing = editing?.rowId === id && editing.key === editable.key}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="tx-grid-edit__cell"
        data-tx-edit-cell
        data-row-id={id}
        data-column-key={editable.key}
        data-pending={pending[key] ? 'true' : undefined}
        ondblclick={() => {
          if (editable.editable) startEdit(row, editable);
        }}
      >
        {#if isEditing && editing && CellEditor}
          <CellEditor
            column={editable}
            draft={editing.draft}
            saveLabel={editText.save}
            invalid={Boolean(errors[key])}
            describedBy={errors[key] ? `${id}--${editable.key}--error` : undefined}
            onDraft={(draft) => {
              if (editing) editing = { ...editing, draft };
            }}
            onKeydown={(event) => onEditorKey(event, row, editable)}
            onSave={() => void commitEdit(row, editable)}
          />
        {:else}
          {displayCellText(row, editable, id, optimistic)}
        {/if}
        {#if errors[key]}
          <p id={`${id}--${editable.key}--error`} class="tx-grid-edit__error" role="alert">
            {errors[key]}
          </p>
        {/if}
      </div>
    {/snippet}
  </DataGrid>

  <p class="tx-grid-edit__status" role="status" aria-live="polite">{announce}</p>
</div>
