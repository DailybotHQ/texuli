/**
 * `@texuli/blocks/text/engine` — Svelte-free text family types, guards and labels.
 * Markdown parser: `@texuli/blocks/text/markdown`. Renderers: `./renderers`.
 */

import type {
  Block,
  CalloutBlock,
  FieldIssue,
  HeadingBlock,
  ListBlock,
  QuoteBlock,
  TextBlock,
} from '../core/index.ts';
import type { BlockIconResolver } from '../icons/types.ts';
import type { TextBlockLabelOverrides } from './labels.ts';

export type { BlockIconResolver } from '../icons/types.ts';

export { checkTextBlock, type TextBlockCheck } from './check.ts';
export {
  DEFAULT_TEXT_BLOCK_LABELS,
  resolveTextBlockLabels,
  type TextBlockLabelOverrides,
  type TextBlockLabels,
} from './labels.ts';

export const TEXT_BLOCK_TYPES = ['heading', 'text', 'list', 'quote', 'callout'] as const;
export type TextFamilyBlockType = (typeof TEXT_BLOCK_TYPES)[number];
export type TextFamilyBlock = HeadingBlock | TextBlock | ListBlock | QuoteBlock | CalloutBlock;

export function isTextFamilyBlock(block: Block): block is TextFamilyBlock {
  return (TEXT_BLOCK_TYPES as readonly string[]).includes(block.type);
}

export interface TextBlockViewProps {
  block: unknown;
  labels?: TextBlockLabelOverrides;
  /** Maps a quote's `avatar:av-…` id to an image URL (the result passes the image URL policy). */
  resolveAvatar?: (id: string) => string | undefined;
  /** Maps list and callout icon names to icons; built-in Texuli icon names draw without it. */
  resolveIcon?: BlockIconResolver;
  oninvalid?: (issues: FieldIssue[]) => void;
}
