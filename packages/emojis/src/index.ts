import sequenceRows from './data/unicode-index.json' with { type: 'json' };

export type EmojiDialect = 'texuli' | 'legacy';
export type EmojiParseMode = 'strict' | 'permissive';
export interface EmojiParseOptions {
  source?: 'unicode' | 'shortcode' | 'both';
}
export interface EmojiMatch {
  readonly id: string;
  readonly unicode: string;
  readonly start: number;
  readonly end: number;
  readonly kind: 'unicode' | 'shortcode';
  readonly source: string;
}
export type EmojiToken =
  | { readonly type: 'text'; readonly text: string; readonly start: number; readonly end: number }
  | ({ readonly type: 'emoji' } & EmojiMatch);

interface SequenceRow extends Array<string> {
  0: string;
  1: string;
  2: string;
}
interface TrieNode {
  children: Map<number, TrieNode>;
  id?: string;
  unicode?: string;
}
const root: TrieNode = { children: new Map() };
const canonicalById = new Map<string, { unicode: string; shortcode: string }>();
const idByShortcode = new Map<string, string>();
for (const row of sequenceRows as SequenceRow[]) {
  const [unicode, id, shortcode] = row;
  if (!unicode || !id || !shortcode) continue;
  if (!canonicalById.has(id)) canonicalById.set(id, { unicode, shortcode });
  idByShortcode.set(shortcode.slice(1, -1), id);
  let node = root;
  for (const character of unicode) {
    const point = character.codePointAt(0);
    if (point === undefined) continue;
    let child = node.children.get(point);
    if (!child) {
      child = { children: new Map() };
      node.children.set(point, child);
    }
    node = child;
  }
  node.id = id;
  node.unicode = unicode;
}

function longestAt(text: string, start: number): EmojiMatch | undefined {
  let node = root;
  let cursor = start;
  let best: EmojiMatch | undefined;
  while (cursor < text.length) {
    const point = text.codePointAt(cursor);
    if (point === undefined) break;
    const child = node.children.get(point);
    if (!child) break;
    cursor += point > 0xffff ? 2 : 1;
    node = child;
    if (node.id && node.unicode) {
      best = {
        id: node.id,
        unicode: node.unicode,
        start,
        end: cursor,
        kind: 'unicode',
        source: text.slice(start, cursor),
      };
    }
  }
  return best;
}

function shortcodeAt(text: string, start: number): EmojiMatch | undefined {
  if (text[start] !== ':') return undefined;
  const end = text.indexOf(':', start + 1);
  if (end < 0 || end - start > 82) return undefined;
  const alias = text.slice(start + 1, end);
  if (!/^[a-z0-9_+-]{1,80}$/.test(alias)) return undefined;
  const id = idByShortcode.get(alias);
  const canonical = id ? canonicalById.get(id) : undefined;
  return id && canonical
    ? {
        id,
        unicode: canonical.unicode,
        start,
        end: end + 1,
        kind: 'shortcode',
        source: text.slice(start, end + 1),
      }
    : undefined;
}

function scan(text: string, options: EmojiParseOptions = {}): EmojiMatch[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const source = options.source ?? 'both';
  const output: EmojiMatch[] = [];
  for (let cursor = 0; cursor < text.length; ) {
    const unicode = source === 'shortcode' ? undefined : longestAt(text, cursor);
    const shortcode = source === 'unicode' ? undefined : shortcodeAt(text, cursor);
    const match =
      unicode && shortcode
        ? unicode.end - cursor >= shortcode.end - cursor
          ? unicode
          : shortcode
        : (unicode ?? shortcode);
    if (match) {
      output.push(match);
      cursor = match.end;
    } else {
      const point = text.codePointAt(cursor);
      cursor += point !== undefined && point > 0xffff ? 2 : 1;
    }
  }
  return output;
}

export function findEmojis(text: string, options: EmojiParseOptions = {}): EmojiMatch[] {
  try {
    return scan(text, options);
  } catch {
    return [];
  }
}

export function parseEmojiTokens(
  text: string,
  options: EmojiParseOptions = {}
): readonly EmojiToken[] {
  try {
    if (typeof text !== 'string') return [];
    const matches = scan(text, options);
    const tokens: EmojiToken[] = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.start > cursor)
        tokens.push({
          type: 'text',
          text: text.slice(cursor, match.start),
          start: cursor,
          end: match.start,
        });
      tokens.push({ type: 'emoji', ...match });
      cursor = match.end;
    }
    if (cursor < text.length)
      tokens.push({ type: 'text', text: text.slice(cursor), start: cursor, end: text.length });
    return tokens;
  } catch {
    return typeof text === 'string' && text
      ? [{ type: 'text', text, start: 0, end: text.length }]
      : [];
  }
}

export function toUnicode(text: string, options: EmojiParseOptions = {}): string {
  if (typeof text !== 'string') return '';
  try {
    const matches = scan(text, { ...options, source: options.source ?? 'shortcode' });
    if (matches.length === 0) return text;
    let output = '';
    let cursor = 0;
    for (const match of matches) {
      output += text.slice(cursor, match.start) + match.unicode;
      cursor = match.end;
    }
    return output + text.slice(cursor);
  } catch {
    return text;
  }
}

export function toShortcodes(text: string, options: EmojiParseOptions = {}): string {
  if (typeof text !== 'string') return '';
  try {
    const matches = scan(text, { ...options, source: options.source ?? 'unicode' });
    if (matches.length === 0) return text;
    let output = '';
    let cursor = 0;
    for (const match of matches) {
      output +=
        text.slice(cursor, match.start) + (canonicalById.get(match.id)?.shortcode ?? match.source);
      cursor = match.end;
    }
    return output + text.slice(cursor);
  } catch {
    return text;
  }
}
