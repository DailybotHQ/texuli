/**
 * `@texuli/blocks/code` (T-blocks-code): the code family's light entry, with
 * the guard, the lazy renderer entry, labels, language resolution and token
 * styles. It loads no grammar and no Svelte. The tokenizer, every grammar and
 * the highlight helpers live in `@texuli/blocks/code/tokenizer`; the
 * renderer in `@texuli/blocks/code/renderers` or through `loadCodeFamily()`.
 */

export { type CodeBlockCheck, checkCodeBlock } from './check.ts';
export {
  CODE_BLOCK_TYPES,
  type CodeBlockBarContext,
  type CodeBlockViewProps,
  type CodeFamilyBlock,
  type CodeFamilyBlockType,
  isCodeFamilyBlock,
  loadCodeFamily,
} from './family.ts';
export {
  CODE_GRAMMAR_LANGUAGES,
  type CodeGrammarLanguage,
  loadCodeGrammar,
  resolveCodeLanguage,
} from './grammars.ts';
export {
  type CodeBlockLabelOverrides,
  type CodeBlockLabels,
  DEFAULT_CODE_BLOCK_LABELS,
  fillCodeLabel,
  resolveCodeBlockLabels,
} from './labels.ts';
export {
  activeHighlightIndex,
  CODE_COLOR_ROLES,
  CODE_TOKEN_STYLES,
  type CodeColorRole,
  type CodeTokenStyle,
  codeTokenClass,
} from './token-styles.ts';
