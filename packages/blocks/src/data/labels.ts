export interface DataBlockLabels {
  invalid: string;
  emptyTable: string;
  tableSummary: string;
  statGroup: string;
  kpiGroup: string;
}

export type DataBlockLabelOverrides = Partial<DataBlockLabels>;

export const DEFAULT_DATA_BLOCK_LABELS: DataBlockLabels = {
  invalid: 'This block could not be shown.',
  emptyTable: 'No rows',
  tableSummary: 'Data table',
  statGroup: 'Statistics',
  kpiGroup: 'Key performance indicators',
};

export function resolveDataBlockLabels(overrides?: DataBlockLabelOverrides): DataBlockLabels {
  return { ...DEFAULT_DATA_BLOCK_LABELS, ...overrides };
}
