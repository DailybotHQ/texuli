export interface DataBlockLabels {
  invalid: string;
  emptyTable: string;
  tableSummary: string;
  statGroup: string;
  kpiGroup: string;
  /** Accessible name of an item's trend sparkline (template with `{label}`). */
  trendName: string;
  /** Shown while a chart family loads, and when it fails to load. */
  chartLoading: string;
  chartLoadError: string;
  /** Part-of-whole charts: the data table toggle and the column headings. */
  chartTable: string;
  chartCategory: string;
  chartValue: string;
}

export type DataBlockLabelOverrides = Partial<DataBlockLabels>;

export const DEFAULT_DATA_BLOCK_LABELS: DataBlockLabels = {
  invalid: 'This block could not be shown.',
  emptyTable: 'No rows',
  tableSummary: 'Data table',
  statGroup: 'Statistics',
  kpiGroup: 'Key performance indicators',
  trendName: '{label} trend',
  chartLoading: 'Loading chart…',
  chartLoadError: 'Chart failed to load',
  chartTable: 'View data table',
  chartCategory: 'Category',
  chartValue: 'Value',
};

export function resolveDataBlockLabels(
  overrides?: DataBlockLabelOverrides,
  /** The defaults to merge over (the view passes them localized through the catalog in context). */
  defaults: Readonly<DataBlockLabels> = DEFAULT_DATA_BLOCK_LABELS
): DataBlockLabels {
  return { ...defaults, ...overrides };
}
