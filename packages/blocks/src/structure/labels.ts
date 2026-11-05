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
  overrides?: StructureBlockLabelOverrides,
  /** The defaults to merge over (the view passes them localized through the catalog in context). */
  defaults: Readonly<StructureBlockLabels> = DEFAULT_STRUCTURE_BLOCK_LABELS
): StructureBlockLabels {
  return { ...defaults, ...overrides };
}
