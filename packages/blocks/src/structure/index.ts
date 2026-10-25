/**
 * `@texuli/blocks` structure family (T-blocks-structure): columns, grid, tabs,
 * accordion, cards, divider and cta. No Svelte is imported eagerly: renderers
 * load through `loadStructureFamily()` (its own chunk) or directly from
 * `@texuli/blocks/structure/renderers`.
 */

export { checkStructureBlock, type StructureBlockCheck } from './check.ts';
export {
  isStructureFamilyBlock,
  loadStructureFamily,
  STRUCTURE_BLOCK_TYPES,
  type StructureBlockViewProps,
  type StructureFamilyBlock,
  type StructureFamilyBlockType,
} from './family.ts';
export {
  DEFAULT_STRUCTURE_BLOCK_LABELS,
  resolveStructureBlockLabels,
  type StructureBlockLabelOverrides,
  type StructureBlockLabels,
} from './labels.ts';
export {
  type AccordionBlock,
  type AccordionItem,
  type CardItem,
  type CardsBlock,
  type GridBlock,
  type GridCell,
  parseAccordionBlock,
  parseCardsBlock,
  parseGridBlock,
  parseStructureBlock,
  parseTabsBlock,
  STRUCTURE_OWNED_TYPES,
  type StructureChildParser,
  type StructureOwnedBlock,
  type StructureOwnedBlockType,
  type TabsBlock,
  type TabsPanel,
} from './schema.ts';
