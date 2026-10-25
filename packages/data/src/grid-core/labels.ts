/** Every visible or announced string the data grid renders. Pass translations to override. */
export interface DataGridLabels {
  /** Accessible name of the search field. */
  search: string;
  /** Header of the selection column (visually hidden). */
  selection: string;
  selectAll: string;
  selectRow: (rowLabel: string) => string;
  /** Shown in place of rows when nothing matches. */
  noResults: string;
  /** Shown while `loading`. */
  loading: string;
  /** Announced when the visible row count changes. */
  rowCount: (count: number, total: number) => string;
  /** Announced when the selection changes. */
  selectedCount: (count: number) => string;
  /** How to use the grid from the keyboard (a hidden description). */
  instructions: string;
}

export const DEFAULT_DATA_GRID_LABELS: Readonly<DataGridLabels> = /* @__PURE__ */ Object.freeze({
  search: 'Search',
  selection: 'Selection',
  selectAll: 'Select all rows',
  selectRow: (rowLabel: string) => `Select ${rowLabel}`,
  noResults: 'No rows match.',
  loading: 'Loading rows…',
  rowCount: (count: number, total: number) =>
    count === total ? `${total} ${total === 1 ? 'row' : 'rows'}` : `${count} of ${total} rows`,
  selectedCount: (count: number) => `${count} selected`,
  instructions:
    'Arrow keys move between cells. Enter or Space on a column header sorts it; Shift adds a sort. Space selects a row; Control or Command plus A selects every row.',
});

/** Merges overrides over the English defaults; values of the wrong type are ignored. */
export function resolveDataGridLabels(overrides: Partial<DataGridLabels> = {}): DataGridLabels {
  const labels = { ...DEFAULT_DATA_GRID_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in labels && typeof value === typeof labels[key]) labels[key] = value;
  }
  return labels as unknown as DataGridLabels;
}
