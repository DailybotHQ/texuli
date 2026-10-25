/**
 * `@texuli/blocks` text family (T-blocks-text): heading, text (paragraphs and
 * rich text), list, quote and callout. No Svelte is imported eagerly:
 * renderers load through `loadTextFamily()` (its own chunk) or directly from
 * `@texuli/blocks/text/renderers`. The package root re-exports only the lazy
 * entry, the guard and the types. The Markdown parser has its own subpath,
 * `@texuli/blocks/text/markdown`, so neither entry pulls it in eagerly.
 */

export { checkTextBlock, type TextBlockCheck } from './check.ts';
export {
  isTextFamilyBlock,
  loadTextFamily,
  TEXT_BLOCK_TYPES,
  type TextBlockViewProps,
  type TextFamilyBlock,
  type TextFamilyBlockType,
} from './family.ts';
export {
  DEFAULT_TEXT_BLOCK_LABELS,
  resolveTextBlockLabels,
  type TextBlockLabelOverrides,
  type TextBlockLabels,
} from './labels.ts';
