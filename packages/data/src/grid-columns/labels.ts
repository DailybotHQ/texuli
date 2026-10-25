/** Every visible or announced string the column grid renders. Pass translations to override. */
export interface ColumnGridLabels {
  /** Accessible name of the search field. */
  search: string;
  noResults: string;
  loading: string;
  rowCount: (count: number, total: number) => string;
  /** How to use the grid from the keyboard (a hidden description). */
  instructions: string;
  /** The column menu button's name. */
  columnMenu: (header: string) => string;
  sortAscending: string;
  sortDescending: string;
  clearSort: string;
  moveEarlier: string;
  moveLater: string;
  pinStart: string;
  pinEnd: string;
  unpin: string;
  wider: string;
  narrower: string;
  resetWidth: string;
  hideColumn: string;
  /** The column chooser's toggle button. */
  columns: string;
  showAll: string;
  resetColumns: string;
  /** Announced after a column operation. */
  moved: (header: string, position: number, total: number) => string;
  resized: (header: string, width: number) => string;
  pinned: (header: string, side: 'start' | 'end' | null) => string;
  hidden: (header: string) => string;
  shown: (header: string) => string;
  reset: string;
}

export const DEFAULT_COLUMN_GRID_LABELS: Readonly<ColumnGridLabels> = /* @__PURE__ */ Object.freeze(
  {
    search: 'Search',
    noResults: 'No rows match.',
    loading: 'Loading rows…',
    rowCount: (count: number, total: number) =>
      count === total ? `${total} ${total === 1 ? 'row' : 'rows'}` : `${count} of ${total} rows`,
    instructions:
      'Arrow keys move between cells. Enter or Space on a column header sorts it; Shift adds a sort. Alt plus Down Arrow, Shift plus F10 or the Menu key on a header opens its column menu: sort, move, pin, resize or hide the column.',
    columnMenu: (header: string) => `Column options for ${header}`,
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    clearSort: 'Clear sort',
    moveEarlier: 'Move earlier',
    moveLater: 'Move later',
    pinStart: 'Pin to start',
    pinEnd: 'Pin to end',
    unpin: 'Unpin',
    wider: 'Wider',
    narrower: 'Narrower',
    resetWidth: 'Reset width',
    hideColumn: 'Hide column',
    columns: 'Columns',
    showAll: 'Show all',
    resetColumns: 'Reset columns',
    moved: (header: string, position: number, total: number) =>
      `${header} moved to position ${position} of ${total}`,
    resized: (header: string, width: number) => `${header} is ${width} pixels wide`,
    pinned: (header: string, side: 'start' | 'end' | null) =>
      side ? `${header} pinned to the ${side}` : `${header} unpinned`,
    hidden: (header: string) => `${header} hidden`,
    shown: (header: string) => `${header} shown`,
    reset: 'Columns reset',
  }
);

/** Merges overrides over the English defaults; values of the wrong type are ignored. */
export function resolveColumnGridLabels(
  overrides: Partial<ColumnGridLabels> = {}
): ColumnGridLabels {
  const labels = { ...DEFAULT_COLUMN_GRID_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in labels && typeof value === typeof labels[key]) labels[key] = value;
  }
  return labels as unknown as ColumnGridLabels;
}
