export interface StructureBlockLabels {
  invalid: string;
  emptyPanel: string;
  cardsLabel: string;
  gridLabel: string;
  columnsLabel: string;
  ctaLabel: string;
}

export type StructureBlockLabelOverrides = Partial<StructureBlockLabels>;

export const DEFAULT_STRUCTURE_BLOCK_LABELS: StructureBlockLabels = {
  invalid: 'This block could not be shown.',
  emptyPanel: 'This panel is empty.',
  cardsLabel: 'Cards',
  gridLabel: 'Grid',
  columnsLabel: 'Columns',
  ctaLabel: 'Actions',
};

export function resolveStructureBlockLabels(
  overrides?: StructureBlockLabelOverrides
): StructureBlockLabels {
  return { ...DEFAULT_STRUCTURE_BLOCK_LABELS, ...overrides };
}
