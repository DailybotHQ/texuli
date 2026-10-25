<script lang="ts" generics="T">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from 'texuli/table';
import {
  selectionState,
  selectRange,
  setVisibleSelected,
  toggleRow,
} from '../engines/grid/selection.ts';
import type { GridSort } from '../engines/grid/sort.ts';
import { type DataGridLabels, resolveDataGridLabels } from './labels.ts';
import {
  ariaSort,
  type CellPosition,
  cellText,
  clampCell,
  type DataGridColumn,
  gridRows,
  moveCell,
  nextSort,
} from './model.ts';
import './grid-core.css';

interface Props {
  rows: readonly T[];
  columns: readonly DataGridColumn<T>[];
  /** Stable id of a row (selection, keys). */
  getRowId: (row: T) => string;
  /** The grid's accessible name, shown as its caption unless `captionHidden`. */
  caption: string;
  captionHidden?: boolean;
  /** Sort keys (`bind:sort`), primary first. */
  sort?: GridSort;
  onSortChange?: (sort: GridSort) => void;
  /** Search text (`bind:search`). */
  search?: string;
  /** Shows a search field above the grid. */
  searchable?: boolean;
  /** A filter AST (`FilterNode`), validated against the columns. */
  filter?: unknown;
  /** Adds a selection column. */
  selectable?: boolean;
  /** Selected row ids (`bind:selected`), in row order. */
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  /** Names a row for its checkbox (default: the first column's text). */
  rowLabel?: (row: T) => string;
  /** Enter on a body cell. */
  onRowActivate?: (row: T) => void;
  /** Custom cell content (receives the row and the column). */
  cell?: Snippet<[T, DataGridColumn<T>]>;
  /** Cells can be edited: those of columns without `editable` are `aria-readonly`. */
  editable?: boolean;
  /** Shown instead of rows when nothing matches. */
  empty?: Snippet;
  loading?: boolean;
  /** Caps the height (a plain CSS length) so the body scrolls under a sticky header. */
  maxBlockSize?: string;
  density?: 'compact' | 'default' | 'comfortable';
  /**
   * Render only the rows in view (plus `overscanRows`) once more than this
   * many rows are visible. Off by default.
   */
  virtualizeAbove?: number;
  /** Row height in px while windowing (match the density; taller rows still render). */
  rowSize?: number;
  /** Scroll area height in px while windowing (unless `maxBlockSize` is set). */
  viewportHeight?: number;
  /** Extra rows rendered above and below the view while windowing. */
  overscanRows?: number;
  locale?: string;
  labels?: Partial<DataGridLabels>;
  class?: ClassValue;
}

let {
  rows,
  columns,
  getRowId,
  caption,
  captionHidden = false,
  sort = $bindable([]),
  onSortChange,
  search = $bindable(''),
  searchable = false,
  filter,
  selectable = false,
  selected = $bindable([]),
  onSelectionChange,
  rowLabel,
  onRowActivate,
  cell,
  editable = false,
  empty,
  loading = false,
  maxBlockSize,
  density = 'default',
  virtualizeAbove = Number.POSITIVE_INFINITY,
  rowSize = 36,
  viewportHeight = 360,
  overscanRows = 4,
  locale,
  labels,
  class: className,
}: Props = $props();

const text = $derived(resolveDataGridLabels(labels));
const uid = $props.id();
const searchId = `${uid}-search`;
const instructionsId = `${uid}-instructions`;

const visible = $derived(
  gridRows(rows, { columns, sort, search, filter, ...(locale ? { locale } : {}) })
);
const visibleIds = $derived(visible.map(getRowId));
const allState = $derived(selectionState(selected, visibleIds));
const selectedSet = $derived(new Set(selected));
/** Grid columns, the selection column included. */
const colCount = $derived(columns.length + (selectable ? 1 : 0));
/** Grid rows, the header row included (an empty grid keeps one body row for its message). */
const rowCount = $derived(1 + Math.max(visible.length, 1));

let active = $state<CellPosition>({ row: 0, col: 0 });
let anchor: string | null = null;
let root: HTMLDivElement | undefined = $state();
const tableElement = () => root?.querySelector('table') ?? null;

// Row windowing: the body renders the rows in view plus overscan, with spacer
// rows standing in for the rest. The active row stays rendered wherever it
// is, so focus and an open editor survive scrolling it out of view.
const virtual = $derived(visible.length > virtualizeAbove);
let scrollTop = $state(0);
let areaHeight = $state(0);
type Slot = { index: number; gap?: undefined } | { index: number; gap: number };
const slots = $derived.by((): Slot[] => {
  const count = visible.length;
  if (!virtual) return visible.map((_, index) => ({ index }));
  const first = Math.floor(scrollTop / rowSize);
  const start = Math.max(0, first - overscanRows);
  const end = Math.min(
    count,
    first + Math.ceil((areaHeight || viewportHeight) / rowSize) + overscanRows
  );
  const pin = active.row - 1;
  const indices: number[] = [];
  if (pin >= 0 && pin < start) indices.push(pin);
  for (let index = start; index < end; index++) indices.push(index);
  if (pin >= end && pin < count) indices.push(pin);
  const out: Slot[] = [];
  let next = 0;
  for (const index of indices) {
    if (index > next) out.push({ index: next, gap: (index - next) * rowSize });
    out.push({ index });
    next = index + 1;
  }
  if (count > next) out.push({ index: next, gap: (count - next) * rowSize });
  return out;
});

function onScroll(event: Event): void {
  const area = event.target as HTMLElement;
  if (!virtual || !area.contains?.(tableElement())) return;
  scrollTop = area.scrollTop;
  areaHeight = area.clientHeight;
}

$effect(() => {
  const next = clampCell(active, rowCount, colCount);
  if (next.row !== active.row || next.col !== active.col) active = next;
});

function setSort(next: GridSort): void {
  sort = next;
  onSortChange?.(next);
}

function setSelected(next: string[]): void {
  selected = next;
  onSelectionChange?.(next);
}

function labelOf(row: T): string {
  return rowLabel?.(row) ?? (columns[0] ? cellText(row, columns[0]) : getRowId(row));
}

function toggle(id: string, shift: boolean): void {
  setSelected(
    shift ? selectRange(selected, visibleIds, anchor, id) : toggleRow(selected, id, visibleIds)
  );
  anchor = id;
}

function align(column: DataGridColumn<T>): 'start' | 'center' | 'end' {
  return column.align ?? (column.type === 'number' ? 'end' : 'start');
}

const isActive = (row: number, col: number) => active.row === row && active.col === col;

/** The element that takes focus for a cell: its single widget, else the cell. */
function focusTarget(position: CellPosition): HTMLElement | null {
  const cellElement = tableElement()?.querySelector<HTMLElement>(
    `[data-tx-grid-cell="${position.row}:${position.col}"]`
  );
  return cellElement?.querySelector<HTMLElement>('[data-tx-grid-widget]') ?? cellElement ?? null;
}

async function focusCell(position: CellPosition): Promise<void> {
  active = position;
  // The sticky header never leaves the view, so moving to it scrolls the body to the top.
  if (!position.row) tableElement()?.parentElement?.scrollTo?.({ top: 0 });
  await tick();
  focusTarget(position)?.focus({ preventScroll: false });
}

function positionOf(target: EventTarget | null): CellPosition | null {
  const cellElement = (target as Element | null)?.closest?.('[data-tx-grid-cell]');
  const value = cellElement?.getAttribute('data-tx-grid-cell');
  if (!value) return null;
  const [row, col] = value.split(':').map(Number);
  return { row: row ?? 0, col: col ?? 0 };
}

function handleKeydown(event: KeyboardEvent): void {
  const position = positionOf(event.target);
  if (!position || event.altKey) return;
  const grid = tableElement();
  const rtl = grid ? getComputedStyle(grid).direction === 'rtl' : false;
  const next = moveCell(position, event, {
    rows: rowCount,
    cols: colCount,
    rtl,
    pageSize: virtual ? Math.floor((areaHeight || viewportHeight) / rowSize) - 1 : 10,
  });
  if (next) {
    event.preventDefault();
    void focusCell(next);
    return;
  }
  const bodyRow = position.row > 0 ? visible[position.row - 1] : undefined;
  if (selectable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    setSelected(setVisibleSelected(selected, visibleIds, allState !== 'all'));
    return;
  }
  const onWidget = (event.target as Element).matches('[data-tx-grid-widget]');
  if (bodyRow && event.key === ' ' && selectable && !onWidget) {
    event.preventDefault();
    toggle(getRowId(bodyRow), event.shiftKey);
    return;
  }
  if (bodyRow && event.key === 'Enter' && onRowActivate && !onWidget) {
    event.preventDefault();
    onRowActivate(bodyRow);
  }
}

/**
 * Focus is on a widget inside a cell (an inline editor, a cell's one control):
 * the widget is then the grid's tab stop and its cell leaves the tab order,
 * so the two never stack as separate targets.
 */
let inWidget = $state(false);

function handleFocusIn(event: FocusEvent): void {
  inWidget = (event.target as Element).matches('[data-tx-grid-widget]');
  const position = positionOf(event.target);
  if (position && (position.row !== active.row || position.col !== active.col)) active = position;
}
</script>

<div
  bind:this={root}
  class={cx('tx-data-grid', className)}
  data-tx-data-grid
  data-virtual={virtual || undefined}
  onscrollcapture={onScroll}
>
  {#if searchable}
    <div class="tx-data-grid__toolbar">
      <label class="tx-data-grid__search-label" for={searchId}>{text.search}</label>
      <input
        id={searchId}
        class="tx-data-grid__search"
        type="search"
        autocomplete="off"
        bind:value={search}
      />
    </div>
  {/if}
  <p id={instructionsId} class="tx-data-grid__sr-only">{text.instructions}</p>
  <Table
    {density}
    stickyHeader={Boolean(maxBlockSize) || virtual}
    {...maxBlockSize || virtual ? { maxBlockSize: maxBlockSize ?? `${viewportHeight}px` } : {}}
    busy={loading}
    role="grid"
    aria-rowcount={visible.length + 1}
    aria-colcount={colCount}
    aria-multiselectable={selectable ? 'true' : undefined}
    aria-describedby={instructionsId}
    onkeydown={handleKeydown}
    onfocusin={handleFocusIn}
    onfocusout={() => (inWidget = false)}
  >
    <TableCaption hidden={captionHidden}>{caption}</TableCaption>
    <TableHeader>
      <TableRow aria-rowindex={1}>
        {#if selectable}
          <TableHead class="tx-data-grid__select" data-tx-grid-cell="0:0" aria-colindex={1}>
            <span class="tx-data-grid__sr-only">{text.selection}</span>
            <input
              type="checkbox"
              class="tx-data-grid__checkbox"
              data-tx-grid-widget
              tabindex={isActive(0, 0) ? 0 : -1}
              aria-label={text.selectAll}
              checked={allState === 'all'}
              indeterminate={allState === 'some'}
              disabled={visible.length === 0}
              onchange={() => setSelected(setVisibleSelected(selected, visibleIds, allState !== 'all'))}
            />
          </TableHead>
        {/if}
        {#each columns as column, index (column.key)}
          {@const col = index + (selectable ? 1 : 0)}
          {@const sortable = column.sortable !== false}
          <TableHead
            align={align(column)}
            data-tx-grid-cell={`0:${col}`}
            aria-colindex={col + 1}
            aria-sort={sortable ? ariaSort(sort, column.key) : undefined}
            tabindex={!sortable && isActive(0, col) ? 0 : !sortable ? -1 : undefined}
          >
            {#if sortable}
              {@const direction = sort.find((entry) => entry.key === column.key)?.direction}
              <button
                type="button"
                class="tx-data-grid__sort"
                data-tx-grid-widget
                data-direction={direction}
                tabindex={isActive(0, col) ? 0 : -1}
                onclick={(event) => setSort(nextSort(sort, column.key, event.shiftKey))}
              >
                {column.header}
                <span class="tx-data-grid__sort-icon" aria-hidden="true">
                  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                    {#if direction === 'asc'}
                      <path d="M6 10V2M3 5l3-3 3 3" />
                    {:else if direction === 'desc'}
                      <path d="M6 2v8m-3-3 3 3 3-3" />
                    {:else}
                      <path d="M6 1.5v9m-2.5-6L6 2l2.5 2.5m-5 3L6 10l2.5-2.5" />
                    {/if}
                  </svg>
                </span>
                {#if sort.length > 1 && direction}
                  <span class="tx-data-grid__sort-rank" aria-hidden="true">{sort.findIndex((entry) => entry.key === column.key) + 1}</span>
                {/if}
              </button>
            {:else}
              {column.header}
            {/if}
          </TableHead>
        {/each}
      </TableRow>
    </TableHeader>
    <TableBody>
      {#if loading || visible.length === 0}
        <TableEmpty colspan={colCount} role="gridcell" data-tx-grid-cell={`1:0`} tabindex={isActive(1, 0) ? 0 : -1}>
          {#if loading}{text.loading}{:else if empty}{@render empty()}{:else}{text.noResults}{/if}
        </TableEmpty>
      {:else}
        {#each slots as slot (slot.gap === undefined ? getRowId(visible[slot.index] as T) : slot)}
          {#if slot.gap !== undefined}
            <tr class="tx-data-grid__spacer" aria-hidden="true">
              <td colspan={colCount} style:block-size="{slot.gap}px"></td>
            </tr>
          {:else}
          {@const row = visible[slot.index] as T}
          {@const rowIndex = slot.index}
          {@const id = getRowId(row)}
          {@const r = rowIndex + 1}
          {@const isSelected = selectedSet.has(id)}
          <TableRow
            selected={isSelected}
            aria-rowindex={r + 1}
            aria-selected={selectable ? isSelected : undefined}
          >
            {#if selectable}
              <TableCell class="tx-data-grid__select" role="gridcell" data-tx-grid-cell={`${r}:0`} aria-colindex={1}>
                <input
                  type="checkbox"
                  class="tx-data-grid__checkbox"
                  data-tx-grid-widget
                  tabindex={isActive(r, 0) ? 0 : -1}
                  aria-label={text.selectRow(labelOf(row))}
                  checked={isSelected}
                  onclick={(event) => {
                    event.preventDefault();
                    toggle(id, event.shiftKey);
                  }}
                />
              </TableCell>
            {/if}
            {#each columns as column, index (column.key)}
              {@const col = index + (selectable ? 1 : 0)}
              <TableCell
                role="gridcell"
                align={align(column)}
                numeric={column.type === 'number'}
                data-tx-grid-cell={`${r}:${col}`}
                aria-colindex={col + 1}
                aria-readonly={editable && !column.editable ? 'true' : undefined}
                tabindex={isActive(r, col) && !inWidget ? 0 : -1}
              >
                {#if cell}{@render cell(row, column)}{:else}{cellText(row, column)}{/if}
              </TableCell>
            {/each}
          </TableRow>
          {/if}
        {/each}
      {/if}
    </TableBody>
  </Table>
  <p class="tx-data-grid__status" role="status" aria-live="polite">
    {text.rowCount(visible.length, rows.length)}{selectable && selected.length > 0 ? ` · ${text.selectedCount(selected.length)}` : ''}
  </p>
</div>
