import type { Grammar } from './tokenizer.ts';

/** Languages with a grammar. Anything else renders as plain text. */
export const CODE_GRAMMAR_LANGUAGES = [
  'ts',
  'js',
  'json',
  'bash',
  'python',
  'html',
  'css',
  'sql',
  'yaml',
] as const;

export type CodeGrammarLanguage = (typeof CODE_GRAMMAR_LANGUAGES)[number];

const ALIASES: Readonly<Record<string, CodeGrammarLanguage>> = {
  typescript: 'ts',
  tsx: 'ts',
  mts: 'ts',
  cts: 'ts',
  javascript: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  jsonc: 'json',
  json5: 'json',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  py: 'python',
  python3: 'python',
  htm: 'html',
  xml: 'html',
  svg: 'html',
  svelte: 'html',
  vue: 'html',
  postgres: 'sql',
  postgresql: 'sql',
  sqlite: 'sql',
  mysql: 'sql',
  yml: 'yaml',
};

/** A language id or alias (`typescript`, `sh`, `yml`…) → a grammar language, or `null`. */
export function resolveCodeLanguage(lang: string): CodeGrammarLanguage | null {
  const key = lang.trim().toLowerCase();
  if ((CODE_GRAMMAR_LANGUAGES as readonly string[]).includes(key)) {
    return key as CodeGrammarLanguage;
  }
  return Object.hasOwn(ALIASES, key) ? (ALIASES[key] as CodeGrammarLanguage) : null;
}

/*
 * One lazy chunk per grammar file: a code block downloads only the grammar of
 * its own language, while the tokenizer core stays in the code family chunk.
 */
const LOADERS: Readonly<Record<CodeGrammarLanguage, () => Promise<Grammar>>> = {
  ts: () => import('./languages/javascript.ts').then((m) => m.typescriptGrammar),
  js: () => import('./languages/javascript.ts').then((m) => m.javascriptGrammar),
  json: () => import('./languages/json.ts').then((m) => m.jsonGrammar),
  bash: () => import('./languages/bash.ts').then((m) => m.bashGrammar),
  python: () => import('./languages/python.ts').then((m) => m.pythonGrammar),
  html: () => import('./languages/html.ts').then((m) => m.htmlGrammar),
  css: () => import('./languages/css.ts').then((m) => m.cssGrammar),
  sql: () => import('./languages/sql.ts').then((m) => m.sqlGrammar),
  yaml: () => import('./languages/yaml.ts').then((m) => m.yamlGrammar),
};

const cache = new Map<CodeGrammarLanguage, Promise<Grammar | null>>();

/**
 * The grammar for a language id or alias, loaded on demand and cached; `null`
 * for `text` and unknown languages. A failed load is not cached, so a later
 * render can retry.
 */
export function loadCodeGrammar(lang: string | undefined): Promise<Grammar | null> {
  const resolved = lang === undefined ? null : resolveCodeLanguage(lang);
  if (resolved === null) return Promise.resolve(null);
  const cached = cache.get(resolved);
  if (cached) return cached;
  const pending = LOADERS[resolved]().then(
    (grammar) => grammar,
    () => {
      cache.delete(resolved);
      return null;
    }
  );
  cache.set(resolved, pending);
  return pending;
}
