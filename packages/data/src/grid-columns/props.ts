import type { Snippet } from 'svelte';
import type { ClassValue } from 'texuli/cx';
import type { ColumnState } from '../engines/grid/columns.ts';
import type { GridSort } from '../engines/grid/sort.ts';
import type { DataGridColumn } from '../grid-core/model.ts';
import type { ColumnGridLabels } from './labels.ts';
import type { ColumnGroupDef } from './model.ts';

/** Public props accepted by the generic column grid component. */
export interface ColumnGridProps<T> {
  rows: readonly T[];
  columns: readonly DataGridColumn<T>[];
  getRowId: (row: T) => string;
  /** The grid's accessible name, shown as its caption unless `captionHidden`. */
  caption: string;
  captionHidden?: boolean;
  /** Spanning group headers above the column headers (one level). */
  groups?: readonly ColumnGroupDef[];
  /** Order, widths, pins and visibility (`bind:columnState`). Untrusted input is validated. */
  columnState?: ColumnState;
  onColumnStateChange?: (state: ColumnState) => void;
  sort?: GridSort;
  onSortChange?: (sort: GridSort) => void;
  search?: string;
  searchable?: boolean;
  /** A filter AST (`FilterNode`), validated against every column, hidden ones included. */
  filter?: unknown;
  onRowActivate?: (row: T) => void;
  cell?: Snippet<[T, DataGridColumn<T>]>;
  empty?: Snippet;
  loading?: boolean;
  maxBlockSize?: string;
  density?: 'compact' | 'default' | 'comfortable';
  locale?: string;
  /** Which operations are offered. All default to `true`. */
  resizable?: boolean;
  reorderable?: boolean;
  pinnable?: boolean;
  hideable?: boolean;
  labels?: Partial<ColumnGridLabels>;
  class?: ClassValue;
}
