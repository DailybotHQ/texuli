/**
 * `@texuli/blocks/structure/engine` — Svelte-free structure parsers, guards and labels.
 */

import type { Block, ColumnsBlock, CtaBlock, DividerBlock, FieldIssue } from '../core/index.ts';
import type { StructureBlockLabelOverrides } from './labels.ts';
import type { AccordionBlock, CardsBlock, GridBlock, TabsBlock } from './schema.ts';

export { checkStructureBlock, type StructureBlockCheck } from './check.ts';
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

export const STRUCTURE_BLOCK_TYPES = [
  'columns',
  'grid',
  'tabs',
  'accordion',
  'cards',
  'divider',
  'cta',
] as const;

export type StructureFamilyBlockType = (typeof STRUCTURE_BLOCK_TYPES)[number];
export type StructureFamilyBlock =
  | ColumnsBlock
  | GridBlock
  | TabsBlock
  | AccordionBlock
  | CardsBlock
  | DividerBlock
  | CtaBlock;

export function isStructureFamilyBlock(block: Block): block is StructureFamilyBlock {
  return (STRUCTURE_BLOCK_TYPES as readonly string[]).includes(block.type);
}

export interface StructureBlockViewProps {
  block: unknown;
  labels?: StructureBlockLabelOverrides;
  oninvalid?: (issues: FieldIssue[]) => void;
}
