/**
 * Build-time syntax coloring for guide snippets (T-80 punch list, row 4).
 *
 * Sink-free by construction: the scanner returns plain text slices tagged
 * with a kind, and `GuideCode.astro` renders each slice as template text
 * (`{token.text}`), so Astro HTML-escapes everything. There is no
 * `{@html}`, no `set:html`, no runtime script and no inline style — the
 * component maps each kind to a class styled with theme tokens.
 *
 * This is deliberately gentle: comments, strings, keywords, tags and flags.
 * It is not a language server, and it never runs on props at runtime — the
 * snippets are author-owned strings in page frontmatter, highlighted once
 * at build time.
 */

export const GUIDE_LANGUAGES = ['auto', 'bash', 'ts', 'css', 'html', 'text'] as const;
export type GuideLanguage = (typeof GUIDE_LANGUAGES)[number];

export const GUIDE_TOKEN_KINDS = ['plain', 'comment', 'keyword', 'string', 'tag', 'flag'] as const;
export type GuideTokenKind = (typeof GUIDE_TOKEN_KINDS)[number];

export interface GuideToken {
  /** The exact source slice; concatenating every token reproduces the input. */
  text: string;
  kind: GuideTokenKind;
}

interface LanguageProfile {
  /** `#` starts a line comment (shell). */
  hashComments: boolean;
  /** `--flag` values get the flag kind (shell). */
  flags: boolean;
  /** `</?tag` prefixes get the tag kind (markup). */
  tags: boolean;
  /** `--custom-prop` gets the flag kind (CSS custom properties). */
  customProperties: boolean;
  /** Words highlighted as keywords, matched on word boundaries. */
  keywords: ReadonlySet<string>;
}

const KEYWORDS = new Set([
  // TypeScript / JavaScript
  'import',
  'from',
  'export',
  'const',
  'let',
  'function',
  'return',
  'await',
  'async',
  'type',
  'interface',
  'new',
  'default',
  // shell commands the guides actually run
  'pnpm',
  'npm',
  'npx',
  'node',
  'texuli',
  'yarn',
  // CSS at-rules and functions used in the snippets
  '@layer',
  '@import',
  '@media',
  '@supports',
  'var',
]);

const PROFILES: Record<Exclude<GuideLanguage, 'auto'>, LanguageProfile> = {
  bash: {
    hashComments: true,
    flags: true,
    tags: false,
    customProperties: false,
    keywords: KEYWORDS,
  },
  ts: {
    hashComments: false,
    flags: false,
    tags: false,
    customProperties: false,
    keywords: KEYWORDS,
  },
  css: {
    hashComments: false,
    flags: false,
    tags: false,
    customProperties: true,
    keywords: KEYWORDS,
  },
  html: {
    hashComments: false,
    flags: false,
    tags: true,
    customProperties: false,
    keywords: KEYWORDS,
  },
  text: {
    hashComments: false,
    flags: false,
    tags: false,
    customProperties: false,
    keywords: new Set<string>(),
  },
};

/**
 * Picks the language for `lang: 'auto'`: shell first (a `#` line or a bare
 * command), then markup, then CSS at-rules, then TypeScript, else plain
 * text. The guide snippets are known strings, so the heuristic only has to
 * separate those five shapes.
 */
function resolveLanguage(code: string, lang: GuideLanguage): Exclude<GuideLanguage, 'auto'> {
  if (lang !== 'auto') return lang;
  if (/^[ \t]*(?:#|pnpm|npm|npx|node|texuli|yarn)\b/m.test(code)) return 'bash';
  if (/<[a-zA-Z/!]/.test(code)) return 'html';
  if (/@layer|@import|--tx-|^[ \t]*\/\*/m.test(code)) return 'css';
  if (/\b(?:import|const|export|function|await)\b/.test(code)) return 'ts';
  return 'text';
}

const WORD = /[A-Za-z@][\w.-]*/y;
const TAG = /<[/]?[A-Za-z][\w.-]*/y;
const FLAG = /--[A-Za-z][\w-]*/y;

/** Whether the character before `index` is token-separating whitespace. */
function precededBySpace(code: string, index: number): boolean {
  if (index <= 0) return true;
  const previous = code[index - 1];
  return previous !== undefined && /\s|[({[=,;]/.test(previous);
}

/** Scans one line with no comment openers left in it. */
function scanLine(line: string, profile: LanguageProfile): GuideToken[] {
  const tokens: GuideToken[] = [];
  const push = (text: string, kind: GuideTokenKind) => {
    if (text.length > 0) tokens.push({ text, kind });
  };
  let plain = '';
  const flush = () => {
    push(plain, 'plain');
    plain = '';
  };
  let index = 0;
  while (index < line.length) {
    const character = line[index];
    if (character === undefined) break;
    // Strings win first so nothing inside them is ever re-tokenized.
    if (character === '"' || character === "'" || character === '`') {
      const close = line.indexOf(character, index + 1);
      const end = close === -1 ? line.length : close + 1;
      flush();
      push(line.slice(index, end), 'string');
      index = end;
      continue;
    }
    // Line comments: `//` everywhere, `#` only where the language says so.
    if (character === '/' && line[index + 1] === '/') {
      flush();
      push(line.slice(index), 'comment');
      return tokens;
    }
    if (profile.hashComments && character === '#') {
      flush();
      push(line.slice(index), 'comment');
      return tokens;
    }
    // Markup tags: `</div`, `<Field`, including the bracket.
    if (profile.tags && character === '<') {
      TAG.lastIndex = index;
      const match = TAG.exec(line);
      if (match?.[0]) {
        flush();
        push(match[0], 'tag');
        index += match[0].length;
        continue;
      }
    }
    // Shell flags and CSS custom properties share the flag kind.
    if ((profile.flags || profile.customProperties) && character === '-') {
      FLAG.lastIndex = index;
      const match = FLAG.exec(line);
      if (match?.[0] && precededBySpace(line, index)) {
        flush();
        push(match[0], 'flag');
        index += match[0].length;
        continue;
      }
    }
    // Words: keywords when the profile lists them, plain otherwise.
    if (/[A-Za-z@]/.test(character)) {
      WORD.lastIndex = index;
      const match = WORD.exec(line);
      if (match?.[0]) {
        const word = match[0];
        flush();
        push(word, profile.keywords.has(word) ? 'keyword' : 'plain');
        index += word.length;
        continue;
      }
    }
    plain += character;
    index += 1;
  }
  flush();
  return tokens;
}

/**
 * Splits `code` into tokens for rendering. Block comments (`/* ... *\/` and
 * `<!-- ... -->`) are pulled out first (shell keeps `#` line comments
 * instead); a `/*` or `<!--` inside a string would be misread, which the
 * guide snippets never do. Every token's text is an exact slice of the
 * input, and concatenating the texts reproduces `code`.
 */
export function highlightGuideCode(code: string, lang: GuideLanguage = 'auto'): GuideToken[] {
  const profile = PROFILES[resolveLanguage(code, lang)];
  if (profile === PROFILES.text) return [{ text: code, kind: 'plain' }];

  const tokens: GuideToken[] = [];
  const emitLines = (source: string) => {
    const lines = source.split('\n');
    for (const [index, line] of lines.entries()) {
      tokens.push(...scanLine(line, profile));
      if (index < lines.length - 1) tokens.push({ text: '\n', kind: 'plain' });
    }
  };

  if (profile.hashComments) {
    emitLines(code);
    return tokens;
  }

  const BLOCK = /\/\*[\s\S]*?(?:\*\/|$)|<!--[\s\S]*?(?:-->|$)/g;
  let cursor = 0;
  for (const match of code.matchAll(BLOCK)) {
    const start = match.index ?? 0;
    emitLines(code.slice(cursor, start));
    tokens.push({ text: match[0], kind: 'comment' });
    cursor = start + match[0].length;
  }
  emitLines(code.slice(cursor));
  return tokens;
}
