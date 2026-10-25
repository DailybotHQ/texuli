import { resolveCodeLanguage } from './grammars.ts';
import { bashGrammar } from './languages/bash.ts';
import { cssGrammar } from './languages/css.ts';
import { htmlGrammar } from './languages/html.ts';
import { javascriptGrammar, typescriptGrammar } from './languages/javascript.ts';
import { jsonGrammar } from './languages/json.ts';
import { pythonGrammar } from './languages/python.ts';
import { sqlGrammar } from './languages/sql.ts';
import { yamlGrammar } from './languages/yaml.ts';
import { type CodeToken, tokenize } from './tokenizer.ts';

const GRAMMARS = {
  ts: typescriptGrammar,
  js: javascriptGrammar,
  json: jsonGrammar,
  bash: bashGrammar,
  python: pythonGrammar,
  html: htmlGrammar,
  css: cssGrammar,
  sql: sqlGrammar,
  yaml: yamlGrammar,
} as const;

/**
 * Tokenizes `code` for `lang` (an id or alias) with every grammar bundled, for
 * servers, tests and tools. Renderers use `loadCodeGrammar` + `tokenize`, which
 * load one grammar on demand. Unknown languages, including `text`, give one
 * plain token. Concatenated texts always equal the input.
 */
export function tokenizeCode(code: string, lang: string): CodeToken[] {
  const resolved = resolveCodeLanguage(lang);
  if (resolved === null) return code === '' ? [] : [{ kind: 'plain', text: code }];
  return tokenize(code, GRAMMARS[resolved]);
}

export {
  bashGrammar,
  cssGrammar,
  htmlGrammar,
  javascriptGrammar,
  jsonGrammar,
  pythonGrammar,
  sqlGrammar,
  typescriptGrammar,
  yamlGrammar,
};
