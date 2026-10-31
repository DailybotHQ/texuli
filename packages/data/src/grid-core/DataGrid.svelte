<script lang="ts" generics="T">
import { getPageTokens } from '@texuli/primitives/pagination';
import type { Snippet } from 'svelte';
import { tick, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from 'texuli/cx';
import type { MotionProp } from 'texuli/motion';
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
import { createLazyListMotion } from '../motion/lazy-list-motion.ts';
import { type DataGridLabels, resolveDataGridLabels } from './labels.ts';
import {
  ariaSort,
  breakpointWidth,
  type CellPosition,
  cellText,
  clampCell,
  type DataGridBulkContext,
  type DataGridColumn,
  type DataGridColumnInput,
  type DataGridEmptyContext,
  gridRows,
  moveCell,
  nextSort,
  resolveDataGridColumns,
} from './model.ts';
import './grid-core.css';

interface OwnProps {
  rows: readonly T[];
  /**
   * The columns. `type` may be left out: it is inferred from the rows (a
   * number, boolean or `Date` value, `enum` with `options`), else `text`.
   * `class` and `headerClass` add classes to the column's cells and header.
   */
  columns: readonly DataGridColumnInput<T>[];
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
  /**
   * Your own match rule for a non-empty `search` (instead of the built-in
   * folded substring over the searchable columns): `(row, query) => boolean`.
   */
  searchPredicate?: (row: T, query: string) => boolean;
  /** A filter AST (`FilterNode`), validated against the columns. */
  filter?: unknown;
  /** Adds a selection column. */
  selectable?: boolean;
  /** Selected row ids (`bind:selected`), in row order. */
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  /**
   * Names a row for its checkbox, and a `rowFocusable` row itself (default:
   * the first column's text).
   */
  rowLabel?: (row: T) => string;
  /**
   * `table` mode only: each body row joins the tab order (`tabindex="0"`,
   * named by `rowLabel`), and Enter or Space on the focused row calls
   * `onRowActivate`. Native table semantics stay (no `role="grid"`, no roving
   * cell focus); controls inside a row keep their own keys. Default `false`;
   * ignored in `grid` mode, which has its own keyboard model.
   */
  rowFocusable?: boolean;
  /** Enter on a body cell (and a click on the row with `activateOnClick`). */
  onRowActivate?: (row: T) => void;
  /**
   * A pointer click on a body row calls `onRowActivate`, except on a control
   * inside the row (a link, button, input, the selection checkbox). Keep a
   * keyboard path: Enter in `grid` mode, or a link or button in a cell.
   */
  activateOnClick?: boolean;
  /**
   * `grid` (default): an APG grid with one tab stop and arrow-key cell
   * navigation. `table`: a static table (native table semantics, no
   * `role="grid"`, no roving focus or grid keys); controls inside it stay in
   * the tab order.
   */
  mode?: 'grid' | 'table';
  /** Custom cell content (receives the row and the column). */
  cell?: Snippet<[T, DataGridColumn<T>]>;
  /** Cells can be edited: those of columns without `editable` are `aria-readonly`. */
  editable?: boolean;
  /** Shown instead of rows when nothing matches; receives the query and whether rows were filtered out. */
  empty?: Snippet<[DataGridEmptyContext]>;
  /** Extra classes for a body row (status tints, emphasis). */
  rowClass?: (row: T) => ClassValue | undefined;
  /** Filter controls, rendered in the toolbar after the search field. */
  filters?: Snippet;
  /** Toolbar actions (export, create…), rendered at the toolbar's end. */
  toolbar?: Snippet;
  /**
   * Shown while rows are selected: the selected ids (every page), their rows
   * and `clear()`. Rendered in a group named by the `bulkActions` label.
   */
  bulkActions?: Snippet<[DataGridBulkContext<T>]>;
  /** Client paging: rows per page (`0`, the default, shows every row). */
  pageSize?: number;
  /** The current page, from 1 (`bind:page`); kept in range as rows change. */
  page?: number;
  onPageChange?: (page: number) => void;
  /**
   * `compact` (default): Previous, "Page N of M", Next. `numbered`: a button
   * per page (the first, the last and the current one's neighbors, with
   * gaps), the current one `aria-current="page"`; the position stays
   * announced.
   */
  pager?: 'compact' | 'numbered';
  /**
   * Rows are loading: the table is `aria-busy` and the status line says the
   * `loading` label (politely). Without `loadingRows` or `loadingRow`, one
   * row shows the label.
   */
  loading?: boolean;
  /**
   * While `loading`, render this many skeleton rows (placeholder bars in every
   * column) instead of the single text row (G107). Only the first is exposed
   * to assistive tech, carrying the `loading` label; the rest are
   * `aria-hidden`. Default `0`, or `3` when `loadingRow` is set; at most 100.
   */
  loadingRows?: number;
  /**
   * Your own skeleton row content, rendered across every column of each
   * skeleton row (receives the row index). Decorative: the grid supplies the
   * accessible loading text.
   */
  loadingRow?: Snippet<[number]>;
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
  /**
   * Motion (`texuli/motion`): rows glide to their new place when the shown
   * order changes (sort, filter, a row added or removed; `layout`, default
   * on). `false` for none; instant under reduced motion and at level `none`.
   */
  motion?: MotionProp;
  /** The root element (bindable). */
  ref?: HTMLElement | null;
}

/**
 * Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the
 * root element, like every texuli and data component.
 */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  rows,
  columns: columnInput,
  getRowId,
  caption,
  captionHidden = false,
  sort = $bindable([]),
  onSortChange,
  search = $bindable(''),
  searchable = false,
  searchPredicate,
  filter,
  selectable = false,
  selected = $bindable([]),
  onSelectionChange,
  rowLabel,
  rowFocusable = false,
  onRowActivate,
  activateOnClick = false,
  mode = 'grid',
  cell,
  editable = false,
  empty,
  rowClass,
  filters,
  toolbar,
  bulkActions,
  pageSize = 0,
  page = $bindable(1),
  onPageChange,
  pager = 'compact',
  loading = false,
  loadingRows,
  loadingRow,
  maxBlockSize,
  density = 'default',
  virtualizeAbove = Number.POSITIVE_INFINITY,
  rowSize = 36,
  viewportHeight = 360,
  overscanRows = 4,
  locale,
  labels,
  class: className,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();

/** The columns, each with a `type` (inferred from the rows when missing). */
const columns = $derived(resolveDataGridColumns(columnInput, rows));
/** Skeleton rows while loading (0: the single text row). */
const skeletonCount = $derived(
  loading ? Math.min(100, Math.max(0, Math.floor(loadingRows ?? (loadingRow ? 3 : 0)) || 0)) : 0
);
const skeletonIndexes = $derived(Array.from({ length: skeletonCount }, (_, index) => index));

const text = $derived(resolveDataGridLabels(labels));
const isGrid = $derived(mode !== 'table');
/** Table mode with keyboard-reachable rows (G92). */
const focusableRows = $derived(!isGrid && rowFocusable);

// Breakpoint column hiding: a column with `hideBelow` leaves the grid while
// the viewport is narrower. Every column shows during SSR and before mount.
const widths = $derived([
  ...new Set(columns.map((column) => breakpointWidth(column.hideBelow)).filter((w) => w !== null)),
]);
let wide = $state<Record<number, boolean>>({});
$effect(() => {
  if (typeof matchMedia !== 'function') return;
  const stops: Array<() => void> = [];
  const next: Record<number, boolean> = {};
  for (const width of widths) {
    const query = matchMedia(`(min-width: ${width}px)`);
    next[width] = query.matches;
    const update = (): void => {
      wide = { ...wide, [width]: query.matches };
    };
    query.addEventListener?.('change', update);
    stops.push(() => query.removeEventListener?.('change', update));
  }
  wide = next;
  return () => {
    for (const stop of stops) stop();
  };
});
/** The columns on screen (breakpoint hiding applied). */
const shownColumns = $derived(
  columns.filter((column) => {
    const width = breakpointWidth(column.hideBelow);
    return width === null || wide[width] !== false;
  })
);
const uid = $props.id();
const searchId = `${uid}-search`;
const instructionsId = `${uid}-instructions`;

const visible = $derived(
  gridRows(rows, {
    columns,
    sort,
    search,
    filter,
    ...(searchPredicate ? { searchPredicate } : {}),
    ...(locale ? { locale } : {}),
  })
);
const pageCount = $derived(pageSize > 0 ? Math.max(1, Math.ceil(visible.length / pageSize)) : 1);
const currentPage = $derived(Math.min(Math.max(1, page), pageCount));
/** Index of the page's first row among the visible rows. */
const offset = $derived(pageSize > 0 ? (currentPage - 1) * pageSize : 0);
/** The rows the body shows: the visible rows, or one page of them. */
const shown = $derived(pageSize > 0 ? visible.slice(offset, offset + pageSize) : visible);
const allIds = $derived(visible.map(getRowId));
/** Ids of the rows on screen: the header checkbox and Shift ranges act on these. */
const visibleIds = $derived(shown.map(getRowId));
const allState = $derived(selectionState(selected, visibleIds));
const selectedSet = $derived(new Set(selected));
/** Grid columns, the selection column included. */
const colCount = $derived(shownColumns.length + (selectable ? 1 : 0));
const columnIndexes = $derived(Array.from({ length: colCount }, (_, index) => index));
/** Grid rows, the header row included (an empty grid keeps one body row for its message). */
const rowCount = $derived(1 + Math.max(shown.length, 1));

let active = $state<CellPosition>({ row: 0, col: 0 });
let anchor: string | null = null;

// Layout motion: measure the rows before the shown order changes, play after.
const rowMotion = createLazyListMotion({
  motion: () => motion,
  defaults: { layout: true, duration: 'base' },
  items: () =>
    Array.from(
      ref?.querySelectorAll<HTMLElement>('tr[data-tx-row-id]') ?? [],
      (element) => [element.getAttribute('data-tx-row-id') ?? '', element] as const
    ),
});
$effect.pre(() => {
  void shown;
  untrack(() => rowMotion.measure());
});
$effect(() => {
  void shown;
  untrack(() => rowMotion.play());
});
const tableElement = () => ref?.querySelector('table') ?? null;

// Row windowing: the body renders the rows in view plus overscan, with spacer
// rows standing in for the rest. The active row stays rendered wherever it
// is, so focus and an open editor survive scrolling it out of view.
const virtual = $derived(shown.length > virtualizeAbove);
let scrollTop = $state(0);
let areaHeight = $state(0);
type Slot = { index: number; gap?: undefined } | { index: number; gap: number };
const slots = $derived.by((): Slot[] => {
  const count = shown.length;
  if (!virtual) return shown.map((_, index) => ({ index }));
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

// Keeps a bound page in range when filtering or search shrinks the rows.
$effect(() => {
  if (pageSize > 0 && page !== currentPage) setPage(currentPage);
});

function setPage(next: number): void {
  page = next;
  onPageChange?.(next);
}

$effect(() => {
  const next = clampCell(active, rowCount, colCount);
  if (next.row !== active.row || next.col !== active.col) active = next;
});

function setSort(next: GridSort): void {
  sort = next;
  onSortChange?.(next);
}

/**
 * Keeps the selection in row order across every page: the paging helpers
 * order by the page they act on, which would put a later page's rows first.
 */
function setSelected(next: string[]): void {
  const wanted = new Set(next);
  const ordered = [...allIds.filter((id) => wanted.delete(id)), ...wanted];
  selected = ordered;
  onSelectionChange?.(ordered);
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

/** A click on a row's own control (link, button, field, label) never activates the row. */
const ROW_CONTROL =
  'a[href], button, input, select, textarea, label, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [data-tx-grid-widget]';

function handleRowClick(event: MouseEvent, row: T): void {
  if (!activateOnClick || !onRowActivate || event.defaultPrevented || event.button !== 0) return;
  const target = event.target as Element | null;
  const control = target?.closest?.(ROW_CONTROL);
  if (control && (event.currentTarget as Element).contains(control)) return;
  // A drag that selected text is not a click on the row.
  const selection = typeof getSelection === 'function' ? getSelection() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim()) return;
  onRowActivate(row);
}

/** Enter or Space on a focused `rowFocusable` row (not a control inside it) activates it. */
function handleRowKeydown(event: KeyboardEvent, row: T): void {
  if (!focusableRows || event.defaultPrevented || event.target !== event.currentTarget) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onRowActivate?.(row);
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isGrid) return;
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
  const bodyRow = position.row > 0 ? shown[position.row - 1] : undefined;
  if (selectable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    // Every visible row, across pages.
    const every = selectionState(selected, allIds) !== 'all';
    setSelected(setVisibleSelected(selected, allIds, every));
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

{#snippet pageButton(target: number, label: string)}
  <button
    type="button"
    class="tx-data-grid__page"
    disabled={target < 1 || target > pageCount}
    onclick={() => setPage(target)}>{label}</button
  >
{/snippet}

<div
  {...rest}
  bind:this={ref}
  class={cx('tx-data-grid', className)}
  data-tx-data-grid
  data-virtual={virtual || undefined}
  onscrollcapture={onScroll}
>
  {#if searchable || filters || toolbar}
    <div class="tx-data-grid__toolbar">
      {#if searchable}
        <label class="tx-data-grid__search-label" for={searchId}>{text.search}</label>
        <input
          id={searchId}
          class="tx-data-grid__search"
          type="search"
          autocomplete="off"
          bind:value={search}
        />
      {/if}
      {@render filters?.()}
      {#if toolbar}<div class="tx-data-grid__actions">{@render toolbar()}</div>{/if}
    </div>
  {/if}
  {#if selectable && bulkActions && selected.length > 0}
    <div class="tx-data-grid__bulk" role="group" aria-label={text.bulkActions}>
      {@render bulkActions({
        selected,
        rows: rows.filter((row) => selectedSet.has(getRowId(row))),
        clear: () => setSelected([]),
      })}
    </div>
  {/if}
  {#if isGrid}<p id={instructionsId} class="tx-data-grid__sr-only">{text.instructions}</p>{/if}
  <Table
    {density}
    stickyHeader={Boolean(maxBlockSize) || virtual}
    {...maxBlockSize || virtual ? { maxBlockSize: maxBlockSize ?? `${viewportHeight}px` } : {}}
    busy={loading}
    {...isGrid
      ? {
          role: 'grid',
          'aria-rowcount': visible.length + 1,
          'aria-colcount': colCount,
          'aria-multiselectable': selectable ? 'true' : undefined,
          'aria-describedby': instructionsId,
          onkeydown: handleKeydown,
          onfocusin: handleFocusIn,
          onfocusout: () => (inWidget = false),
        }
      : {}}
    data-mode={mode}
  >
    <TableCaption hidden={captionHidden}>{caption}</TableCaption>
    <TableHeader>
      <TableRow aria-rowindex={1}>
        {#if selectable}
          <TableHead class="tx-data-grid__select" data-tx-grid-cell="0:0" aria-colindex={isGrid ? 1 : undefined}>
            <span class="tx-data-grid__sr-only">{text.selection}</span>
            <input
              type="checkbox"
              class="tx-data-grid__checkbox"
              data-tx-grid-widget
              tabindex={isGrid ? (isActive(0, 0) ? 0 : -1) : undefined}
              aria-label={text.selectAll}
              checked={allState === 'all'}
              indeterminate={allState === 'some'}
              disabled={visible.length === 0}
              onchange={() => setSelected(setVisibleSelected(selected, visibleIds, allState !== 'all'))}
            />
          </TableHead>
        {/if}
        {#each shownColumns as column, index (column.key)}
          {@const col = index + (selectable ? 1 : 0)}
          {@const sortable = column.sortable !== false}
          <TableHead
            class={column.headerClass}
            align={align(column)}
            data-tx-grid-cell={`0:${col}`}
            aria-colindex={isGrid ? col + 1 : undefined}
            aria-sort={sortable ? ariaSort(sort, column.key) : undefined}
            tabindex={!isGrid || sortable ? undefined : isActive(0, col) ? 0 : -1}
          >
            {#if sortable}
              {@const direction = sort.find((entry) => entry.key === column.key)?.direction}
              <button
                type="button"
                class="tx-data-grid__sort"
                data-tx-grid-widget
                data-direction={direction}
                tabindex={isGrid ? (isActive(0, col) ? 0 : -1) : undefined}
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
      {#if skeletonCount > 0}
        <!-- Skeleton rows (G107): the first carries the loading text (and, as a
             grid, the body's focusable cell); the rest are decorative. -->
        {#each skeletonIndexes as index (index)}
          <TableRow data-tx-grid-skeleton aria-hidden={index > 0 ? 'true' : undefined}>
            {#each loadingRow ? [0] : columnIndexes as col (col)}
              {@const first = index + col === 0}
              <TableCell
                colspan={loadingRow ? colCount : undefined}
                {...first && isGrid ? { role: 'gridcell', tabindex: isActive(1, 0) ? 0 : -1 } : {}}
                data-tx-grid-cell={first ? '1:0' : undefined}
              >
                {#if first}<span class="tx-data-grid__sr-only">{text.loading}</span>{/if}
                {#if loadingRow}<span aria-hidden="true">{@render loadingRow(index)}</span>{:else}<span
                    class="tx-data-grid__skeleton"
                    aria-hidden="true"
                  ></span>{/if}
              </TableCell>
            {/each}
          </TableRow>
        {/each}
      {:else if loading || shown.length === 0}
        <TableEmpty
          colspan={colCount}
          {...isGrid ? { role: 'gridcell', tabindex: isActive(1, 0) ? 0 : -1 } : {}}
          data-tx-grid-cell={`1:0`}
        >
          {#if loading}{text.loading}{:else if empty}{@render empty({ query: search, filtered: rows.length > 0 })}{:else}{text.noResults}{/if}
        </TableEmpty>
      {:else}
        {#each slots as slot (slot.gap === undefined ? getRowId(shown[slot.index] as T) : slot)}
          {#if slot.gap !== undefined}
            <tr class="tx-data-grid__spacer" aria-hidden="true">
              <td colspan={colCount} style:block-size="{slot.gap}px"></td>
            </tr>
          {:else}
          {@const row = shown[slot.index] as T}
          {@const rowIndex = slot.index}
          {@const id = getRowId(row)}
          {@const r = rowIndex + 1}
          {@const isSelected = selectedSet.has(id)}
          <TableRow
            class={rowClass?.(row)}
            selected={isSelected}
            aria-rowindex={isGrid ? offset + r + 1 : undefined}
            aria-selected={selectable && isGrid ? isSelected : undefined}
            data-tx-row-id={id}
            data-activatable={activateOnClick && onRowActivate ? '' : undefined}
            {...focusableRows
              ? {
                  tabindex: 0,
                  'aria-label': labelOf(row),
                  'data-focusable': '',
                  onkeydown: (event: KeyboardEvent) => handleRowKeydown(event, row),
                }
              : {}}
            onclick={(event: MouseEvent) => handleRowClick(event, row)}
          >
            {#if selectable}
              <TableCell
                class="tx-data-grid__select"
                {...isGrid ? { role: 'gridcell', 'aria-colindex': 1 } : {}}
                data-tx-grid-cell={`${r}:0`}
              >
                <input
                  type="checkbox"
                  class="tx-data-grid__checkbox"
                  data-tx-grid-widget
                  tabindex={isGrid ? (isActive(r, 0) ? 0 : -1) : undefined}
                  aria-label={text.selectRow(labelOf(row))}
                  checked={isSelected}
                  onclick={(event) => {
                    event.preventDefault();
                    toggle(id, event.shiftKey);
                  }}
                />
              </TableCell>
            {/if}
            {#each shownColumns as column, index (column.key)}
              {@const col = index + (selectable ? 1 : 0)}
              <TableCell
                {...isGrid
                  ? {
                      role: 'gridcell',
                      'aria-colindex': col + 1,
                      'aria-readonly': editable && !column.editable ? 'true' : undefined,
                      tabindex: isActive(r, col) && !inWidget ? 0 : -1,
                    }
                  : {}}
                class={column.class}
                align={align(column)}
                numeric={column.type === 'number'}
                data-tx-grid-cell={`${r}:${col}`}
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
  {#if pageSize > 0 && pageCount > 1}
    <nav class="tx-data-grid__pager" aria-label={text.pagination(caption)}>
      {@render pageButton(currentPage - 1, text.previousPage)}
      {#if pager === 'numbered'}
        {#each getPageTokens(currentPage, pageCount) as token (token)}
          {#if typeof token === 'number'}
            <button
              type="button"
              class="tx-data-grid__page tx-data-grid__page--number"
              aria-label={text.page(token)}
              aria-current={token === currentPage ? 'page' : undefined}
              onclick={() => setPage(token)}>{token}</button
            >
          {:else}
            <span class="tx-data-grid__page-gap" data-tx-page-gap aria-hidden="true">…</span>
          {/if}
        {/each}
      {/if}
      <span class={pager === 'numbered' ? 'tx-data-grid__sr-only' : undefined} aria-live="polite"
        >{text.pageOf(currentPage, pageCount)}</span
      >
      {@render pageButton(currentPage + 1, text.nextPage)}
    </nav>
  {/if}
  <p class="tx-data-grid__status" role="status" aria-live="polite">
    {#if loading}{text.loading}{:else}{text.rowCount(visible.length, rows.length)}{selectable && selected.length > 0 ? ` · ${text.selectedCount(selected.length)}` : ''}{/if}
  </p>
</div>
