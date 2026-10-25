/**
 * `@texuli/blocks/code/tokenizer`: an owned, linear-time code tokenizer.
 * Source becomes `{ kind, text }` tokens for ts, js, json, bash, python, html,
 * css, sql and yaml; renderers print the text in spans colored by theme
 * roles and never build HTML. Ported from Protoyard's code family (which
 * replaced a 303 KB highlight.js).
 *
 * ```ts
 * const lines = splitTokenLines(tokenizeCode('const a = 1;', 'ts'));
 * // [[{ kind: 'keyword', text: 'const' }, { kind: 'plain', text: ' a ' }, …]]
 * ```
 *
 * This entry bundles every grammar, for tools, servers and tests. The
 * renderer loads only the grammar of each block's language (`loadCodeGrammar`).
 */

export {
  countCodeLines,
  type HighlightStep,
  parseLineSpec,
  resolveHighlightSteps,
} from './highlight.ts';
export {
  bashGrammar,
  cssGrammar,
  htmlGrammar,
  javascriptGrammar,
  jsonGrammar,
  pythonGrammar,
  sqlGrammar,
  tokenizeCode,
  typescriptGrammar,
  yamlGrammar,
} from './tokenize-code.ts';
export {
  CODE_TOKEN_KINDS,
  CODE_TOKENIZE_MAX_LENGTH,
  type CodeToken,
  type CodeTokenKind,
  type Grammar,
  type GrammarRule,
  type RuleContext,
  splitTokenLines,
  sticky,
  tokenize,
} from './tokenizer.ts';
