<script lang="ts">
import { type EditableColumn, EditableDataGrid } from '@texuli/data/grid-editing';
import { untrack } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { parseFormula } from '../formula/parse.ts';
import { cellAddress, columnName } from '../formula/reference.ts';
import { displayValue, inputText, parseSheetInput } from '../model/input.ts';
import type { SheetDocument } from '../model/types.ts';
import { createWorkbook, type Workbook } from '../model/workbook.ts';
import { resolveSheetViewLabels, type SheetViewLabels } from './labels.ts';
import './sheet-view.css';

/**
 * A spreadsheet over the data grid's editing layer (an APG grid: one tab
 * stop, arrow keys between cells, Enter or F2 to edit, Escape to cancel,
 * undo and redo, TSV copy and paste). Cells show computed values; the
 * editor and the formula bar show what was typed. The sheet document is
 * the source of truth: every edit emits a new one (`bind:sheet`).
 */
interface Props {
  /** The workbook as a sheet document (`bind:sheet`); validate untrusted ones first. */
  sheet: SheetDocument;
  /** The id of the sheet shown (`bind:activeSheet`; default the first). */
  activeSheet?: string;
  /** Cells cannot be edited. */
  readonly?: boolean;
  /** The grid's accessible name (default: the document title, then the sheet name). */
  label?: string;
  /** Called with the new document after every edit. */
  onchange?: (sheet: SheetDocument) => void;
  /** The host clock for TODAY and NOW; without it they show #N/A. */
  now?: () => number | Date;
  /** Shows the formula bar (default `true`). */
  formulaBar?: boolean;
  labels?: Partial<SheetViewLabels>;
  density?: 'compact' | 'default' | 'comfortable';
  /** Window rows once more than this many show (default 1000). */
  virtualizeAbove?: number;
  /** Scroll area height in px while windowing. */
  viewportHeight?: number;
  class?: ClassValue;
}

let {
  sheet = $bindable(),
  activeSheet = $bindable(),
  readonly = false,
  label,
  onchange,
  now,
  formulaBar = true,
  labels,
  density = 'compact',
  virtualizeAbove = 1000,
  viewportHeight = 420,
  class: className,
}: Props = $props();

interface Row {
  /** The stable row id. */
  readonly id: string;
  /** The 0-based row index. */
  readonly n: number;
  /** The workbook version this row object was read at (new objects repaint the cells). */
  readonly v: number;
}

const text = $derived(resolveSheetViewLabels(labels));

let source: SheetDocument = untrack(() => sheet);
let workbook: Workbook = $state.raw(untrack(() => createWorkbook(sheet, now ? { now } : {})));
/** Bumps after every change so rows and cells re-read the workbook. */
let version = $state(0);
let focused = $state<{ rowId: string; columnKey: string } | null>(null);

// A new document from the host (not one this view emitted) rebuilds the workbook.
$effect.pre(() => {
  const next = sheet;
  if (next === source) return;
  source = next;
  workbook = createWorkbook(
    next,
    untrack(() => (now ? { now } : {}))
  );
  version += 1;
});

const current = $derived.by(() => {
  void version;
  return workbook.sheet(activeSheet ?? '') ?? workbook.sheets[0];
});
const sheetId = $derived(current?.id ?? '');

const rows = $derived.by((): Row[] => {
  void version;
  const v = version;
  return (current?.rowIds ?? []).map((id, n) => ({ id, n, v }));
});

const columns = $derived.by((): EditableColumn<Row>[] => {
  void version;
  const book = workbook;
  const id = sheetId;
  const out: EditableColumn<Row>[] = [
    {
      key: '__row',
      header: text.row,
      type: 'number',
      accessor: (row) => row.n + 1,
      sortable: false,
      searchable: false,
      align: 'end',
      width: 56,
    },
  ];
  (current?.columnIds ?? []).forEach((columnId, c) => {
    out.push({
      key: columnId,
      header: columnName(c),
      type: 'text',
      editable: !readonly,
      sortable: false,
      searchable: false,
      minWidth: 96,
      accessor: (row) => inputText(book.input(id, row.n, c)),
      format: (_value, row) => displayValue(book.value(id, row.n, c)),
      validate: (value) => {
        const typed = value === null || value === undefined ? '' : String(value);
        if (!typed.startsWith('=') || typed.length < 2) return null;
        const parsed = parseFormula(typed);
        if (parsed.ok || parsed.error === '#NAME?') return null;
        return text.formulaError(parsed.diagnostics[0]?.message ?? '');
      },
    });
  });
  return out;
});

const caption = $derived(label ?? workbook.title ?? `${text.sheet} ${current?.name ?? ''}`.trim());

const where = $derived.by(() => {
  void version;
  if (!focused || !current) return null;
  const row = current.rowIds.indexOf(focused.rowId);
  const col = current.columnIds.indexOf(focused.columnKey);
  if (row < 0 || col < 0) return null;
  return { address: cellAddress(row, col), input: inputText(workbook.input(sheetId, row, col)) };
});

function emit(): void {
  version += 1;
  const next = workbook.toDocument();
  source = next;
  sheet = next;
  onchange?.(next);
}

function commit(row: Row, columnKey: string, value: unknown): void {
  const col = current?.columnIds.indexOf(columnKey) ?? -1;
  if (col < 0) return;
  const typed = value === null || value === undefined ? '' : String(value);
  workbook.setInput(sheetId, row.n, col, parseSheetInput(typed));
  emit();
}

function apply(rowId: string, columnKey: string, value: unknown): void {
  const row = current?.rowIds.indexOf(rowId) ?? -1;
  const col = current?.columnIds.indexOf(columnKey) ?? -1;
  if (row < 0 || col < 0) return;
  const typed = value === null || value === undefined ? '' : String(value);
  workbook.setInput(sheetId, row, col, parseSheetInput(typed));
  emit();
}
</script>

<div class={cx('tx-sheets-view', className)} data-tx-sheets-view>
  {#if workbook.sheets.length > 1}
    <div class="tx-sheets-view__tabs" role="group" aria-label={text.sheets}>
      {#each workbook.sheets as tab (tab.id)}
        <button
          type="button"
          class="tx-sheets-view__tab"
          aria-pressed={tab.id === sheetId}
          onclick={() => {
            activeSheet = tab.id;
            focused = null;
          }}
        >
          {tab.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if formulaBar}
    <div class="tx-sheets-view__bar" role="group" aria-label={text.formulaBar} data-tx-sheet-bar>
      <span class="tx-sheets-view__address">{where?.address ?? ''}</span>
      <span class="tx-sheets-view__input">{where?.input ?? ''}</span>
    </div>
  {/if}

  {#key sheetId}
    <EditableDataGrid
      {rows}
      {columns}
      getRowId={(row) => row.id}
      {caption}
      captionHidden
      {density}
      {virtualizeAbove}
      {viewportHeight}
      onCommit={commit}
      onApply={apply}
      onFocusCell={(cell) => {
        focused = cell;
      }}
    />
  {/key}
</div>
