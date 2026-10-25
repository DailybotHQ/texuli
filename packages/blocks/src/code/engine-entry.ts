/**
 * `@texuli/blocks/code/engine` — Svelte-free code family surface for hosts that
 * parse/highlight without mounting the renderer. Grammars + labels + checks;
 * full tokenize helpers remain on `@texuli/blocks/code/tokenizer`.
 */

export { type CodeBlockCheck, checkCodeBlock } from './check.ts';
export {
  CODE_BLOCK_TYPES,
  type CodeBlockViewProps,
  type CodeFamilyBlock,
  type CodeFamilyBlockType,
  isCodeFamilyBlock,
} from './family-engine.ts';
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
