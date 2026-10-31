import type { ClassValue } from 'texuli/cx';
import {
  type GridColumnDef,
  type GridValue,
  type GridValueType,
  readValue,
} from '../engines/grid/columns.ts';
import { compileFilter } from '../engines/grid/filter.ts';
import { foldedKey, type GridSort, sortRows } from '../engines/grid/sort.ts';

/** A data grid column: the engine's column plus how the grid shows it. */
export interface DataGridColumn<T> extends GridColumnDef<T> {
  /** The header toggles sorting. Default `true`. */
  sortable?: boolean;
  /** Search reads this column. Default `true` for text and enum columns. */
  searchable?: boolean;
  /** Text alignment. Default `end` for numbers, else `start`. */
  align?: 'start' | 'center' | 'end';
  /** Display text of a value (default: the value as text; dates as ISO day). */
  format?: (value: GridValue, row: T) => string;
  /** In an `editable` grid, cells of this column can be edited (others are read-only). */
  editable?: boolean;
  /**
   * Hides the column while the viewport is narrower than a breakpoint: `sm`
   * (640px), `md` (768px), `lg` (1024px), `xl` (1280px) or a width in px.
   * Hidden columns leave the grid (header, cells, column count and keyboard
   * model); search and filters still read them.
   */
  hideBelow?: DataGridBreakpoint;
  /** Extra classes for this column's body cells (G107). */
  class?: ClassValue;
  /** Extra classes for this column's header cell (G107). */
  headerClass?: ClassValue;
}

/**
 * A column as `DataGrid` accepts it (G107): `type` is optional, inferred from
 * the rows by {@link inferColumnType}. Every `DataGridColumn` is one.
 */
export type DataGridColumnInput<T> = Omit<DataGridColumn<T>, 'type'> & { type?: GridValueType };

/**
 * The type of a column without one: `enum` when it lists `options`, else the
 * kind of the first non-empty value in `rows` (a number, a boolean or a
 * `Date`), else `text`. Strings stay `text` (an ISO date string is not
 * guessed); set `type: 'date'` for those.
 */
export function inferColumnType<T>(
  rows: readonly T[],
  column: DataGridColumnInput<T>
): GridValueType {
  if (column.type) return column.type;
  if (column.options) return 'enum';
  for (const row of rows) {
    const value = readValue(row, column as GridColumnDef<T>);
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'text';
  }
  return 'text';
}

/** Gives every column a `type` (inferred when missing); typed columns pass through unchanged. */
export function resolveDataGridColumns<T>(
  columns: readonly DataGridColumnInput<T>[],
  rows: readonly T[]
): DataGridColumn<T>[] {
  return columns.map((column) =>
    column.type ? (column as DataGridColumn<T>) : { ...column, type: inferColumnType(rows, column) }
  );
}

/** A named viewport breakpoint or a width in px. */
export type DataGridBreakpoint = 'sm' | 'md' | 'lg' | 'xl' | number;

const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

/** The min width in px a column needs to show, or `null` (always shown). */
export function breakpointWidth(value: DataGridBreakpoint | undefined): number | null {
  if (value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  return BREAKPOINTS[value] ?? null;
}

/** What the `empty` snippet receives. */
export interface DataGridEmptyContext {
  /** The search text (`''` without a search). */
  query: string;
  /** Rows exist but the search or filter matched none of them. */
  filtered: boolean;
}

/** What the `bulkActions` snippet receives while rows are selected. */
export interface DataGridBulkContext<T> {
  /** Selected row ids, on every page, in row order. */
  selected: readonly string[];
  /** The selected rows (from `rows`, whatever the filter and page). */
  rows: T[];
  /** Clears the selection. */
  clear: () => void;
}

/** Display text of a cell: `format`, else the value as plain text. */
export function cellText<T>(row: T, column: DataGridColumn<T>): string {
  const value = readValue(row, column);
  if (column.format) return column.format(value, row);
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return String(value);
}

function searchableColumns<T>(columns: readonly DataGridColumn<T>[]): DataGridColumn<T>[] {
  return columns.filter(
    (column) => column.searchable ?? (column.type === 'text' || column.type === 'enum')
  );
}

/**
 * Rows matching a search: every word of the query must appear in some
 * searchable column's display text, ignoring case and accents.
 */
export function searchRows<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  query: string
): T[] {
  const words = foldedKey(query.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  const fields = searchableColumns(columns);
  return rows.filter((row) => {
    const haystack = fields.map((column) => foldedKey(cellText(row, column))).join('\u0000');
    return words.every((word) => haystack.includes(word));
  });
}

export interface GridRowsOptions<T> {
  columns: readonly DataGridColumn<T>[];
  sort?: GridSort;
  search?: string;
  /**
   * Replaces the built-in search (a folded substring over the searchable
   * columns): a row matches a non-empty `search` when this returns true.
   */
  searchPredicate?: (row: T, query: string) => boolean;
  /** A filter AST (`FilterNode`) for `compileFilter`; invalid filters throw. */
  filter?: unknown;
  locale?: string;
}

/** The visible rows: filter, then search, then a stable sort. */
export function gridRows<T>(rows: readonly T[], options: GridRowsOptions<T>): T[] {
  const { columns } = options;
  let result: T[] = [...rows];
  if (options.filter !== undefined && options.filter !== null) {
    const predicate = compileFilter(options.filter, columns);
    result = result.filter(predicate);
  }
  const { search, searchPredicate } = options;
  if (search) {
    result = searchPredicate
      ? result.filter((row) => searchPredicate(row, search))
      : searchRows(result, columns, search);
  }
  if (options.sort && options.sort.length > 0) {
    result = sortRows(
      result,
      options.sort,
      columns,
      options.locale ? { locale: options.locale } : {}
    );
  }
  return result;
}

/**
 * The next sort after activating a header: none → ascending → descending →
 * none. Without `additive` the column becomes the only sort key; with it
 * (Shift) the column is added to, cycled in or removed from the keys.
 */
export function nextSort(sort: GridSort, key: string, additive = false): GridSort {
  const current = sort.find((entry) => entry.key === key);
  const next: GridSort[number] | null = !current
    ? { key, direction: 'asc' }
    : current.direction === 'asc'
      ? { key, direction: 'desc' }
      : null;
  if (!additive) return next ? [next] : [];
  const others = sort.filter((entry) => entry.key !== key);
  if (!next) return others;
  return current ? sort.map((entry) => (entry.key === key ? next : entry)) : [...sort, next];
}

/** `aria-sort` of a header: only the primary sort key is announced. */
export function ariaSort(sort: GridSort, key: string): 'ascending' | 'descending' | 'none' {
  const primary = sort[0];
  if (!primary || primary.key !== key) return 'none';
  return primary.direction === 'asc' ? 'ascending' : 'descending';
}

/** A cell position: row 0 is the header row; columns count from 0. */
export interface CellPosition {
  row: number;
  col: number;
}

export interface MoveCellOptions {
  rows: number;
  cols: number;
  /** Rows PageUp and PageDown move. Default 10. */
  pageSize?: number;
  rtl?: boolean;
}

/**
 * Where a key moves the focused cell in an APG grid, or `null` for keys that
 * do not move. Arrows move one cell (left and right swap in RTL) and stop at
 * the edges; Home and End go to the row's first and last cell, with Ctrl (or
 * Cmd) to the grid's; PageUp and PageDown move a page of rows.
 */
export function moveCell(
  position: CellPosition,
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>,
  options: MoveCellOptions
): CellPosition | null {
  const lastRow = Math.max(0, options.rows - 1);
  const lastCol = Math.max(0, options.cols - 1);
  const page = Math.max(1, options.pageSize ?? 10);
  const forward = options.rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = options.rtl ? 'ArrowRight' : 'ArrowLeft';
  const ctrl = event.ctrlKey || event.metaKey;
  const clampRow = (row: number) => Math.min(lastRow, Math.max(0, row));
  const clampCol = (col: number) => Math.min(lastCol, Math.max(0, col));
  switch (event.key) {
    case 'ArrowDown':
      return { row: clampRow(position.row + 1), col: position.col };
    case 'ArrowUp':
      return { row: clampRow(position.row - 1), col: position.col };
    case forward:
      return { row: position.row, col: clampCol(position.col + 1) };
    case back:
      return { row: position.row, col: clampCol(position.col - 1) };
    case 'Home':
      return ctrl ? { row: 0, col: 0 } : { row: position.row, col: 0 };
    case 'End':
      return ctrl ? { row: lastRow, col: lastCol } : { row: position.row, col: lastCol };
    case 'PageDown':
      return { row: clampRow(position.row + page), col: position.col };
    case 'PageUp':
      return { row: clampRow(position.row - page), col: position.col };
    default:
      return null;
  }
}

/** Keeps a position inside the grid after rows or columns change. */
export function clampCell(position: CellPosition, rows: number, cols: number): CellPosition {
  return {
    row: Math.min(Math.max(0, rows - 1), Math.max(0, position.row)),
    col: Math.min(Math.max(0, cols - 1), Math.max(0, position.col)),
  };
}
