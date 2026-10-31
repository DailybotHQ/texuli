/**
 * `@texuli/data/grid-core` (T-data-grid-core): the data grid view. Columns,
 * multi-sort, search and filter (the grid engine's AST), row selection and
 * APG grid keyboard navigation, rendered on the texuli Table. The model is
 * framework-free and exported for tests and custom views.
 */
export { default as DataGrid } from './DataGrid.svelte';
export {
  type DataGridLabels,
  DEFAULT_DATA_GRID_LABELS,
  resolveDataGridLabels,
} from './labels.ts';
export {
  ariaSort,
  breakpointWidth,
  type CellPosition,
  cellText,
  clampCell,
  type DataGridBreakpoint,
  type DataGridBulkContext,
  type DataGridColumn,
  type DataGridColumnInput,
  type DataGridEmptyContext,
  type GridRowsOptions,
  gridRows,
  inferColumnType,
  type MoveCellOptions,
  moveCell,
  nextSort,
  resolveDataGridColumns,
  searchRows,
} from './model.ts';
