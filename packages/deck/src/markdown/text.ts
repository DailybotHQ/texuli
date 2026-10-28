/**
 * Text helpers shared by the Markdown reader, the canonical writer and the
 * text twins: hidden characters, escaping (ported from Protoyard's
 * `text/escape.ts`), unescaping, slugs and inert JSON.
 */

/**
 * Hidden characters the dialect refuses (Trojan Source): C0 and C1 controls
 * except tab and line feed, bidi embeddings, overrides and isolates, the
 * Arabic letter mark, the Mongolian vowel separator, zero-width space, LRM,
 * RLM, word joiner and invisible operators, and the BOM. ZWJ and ZWNJ stay
 * (emoji sequences and Persian text need them).
 */
export function isHiddenCode(code: number): boolean {
  return (
    (code <= 0x1f && code !== 0x09 && code !== 0x0a) ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x61c ||
    code === 0x180e ||
    code === 0x200b ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/**
 * Trailing spaces and tabs removed, by index (linear). Regexes such as
 * `/[ \t]+$/` scan every run once per start position: quadratic on a long
 * run that is followed by text.
 */
export function trimBlankEnd(text: string): string {
  let end = text.length;
  while (end > 0) {
    const code = text.charCodeAt(end - 1);
    if (code !== 0x20 && code !== 0x09) break;
    end--;
  }
  return end === text.length ? text : text.slice(0, end);
}

/** Trailing `char` repeats removed, by index (linear; see `trimBlankEnd`). */
export function trimCharEnd(text: string, char: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === char) end--;
  return end === text.length ? text : text.slice(0, end);
}

/** Remove hidden characters (see `isHiddenCode`). */
export function stripHidden(text: string): string {
  let out = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (isHiddenCode(text.charCodeAt(i))) {
      out += text.slice(start, i);
      start = i + 1;
    }
  }
  return start === 0 ? text : out + text.slice(start);
}

/** Characters that are Markdown or HTML syntax anywhere in a line. */
const ANYWHERE = /[\\`*_{}[\]<>|~&$]/g;
/** `https://…` and `www.…` would become links when read back. */
const AUTOLINK_SCHEME = /\b([a-z][a-z0-9+.-]{0,31}):(?=\/\/)/gi;
const AUTOLINK_WWW = /\b(www)\./gi;

/** Escape block syntax that only matters at the start of a line. */
export function escapeLineStart(line: string): string {
  return line
    .replace(/^(\s*)([#+\-=>:!])/, '$1\\$2')
    .replace(/^(\s*\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^(\s*)(Notes?|notes?)(:)/, '$1$2\\$3');
}

/**
 * Plain text as one inert Markdown line: whitespace runs become one space,
 * inline syntax is backslash-escaped and block syntax at the start is too,
 * so nothing an author typed becomes structure, HTML or a link.
 */
export function escapeInline(text: string): string {
  const flat = stripHidden(text)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ANYWHERE, '\\$&')
    .replace(AUTOLINK_SCHEME, '$1\\:')
    .replace(AUTOLINK_WWW, '$1\\.');
  return escapeLineStart(flat);
}

/** Plain text as inert Markdown, keeping line breaks as separate escaped lines. */
export function escapeText(text: string): string {
  return stripHidden(text)
    .split('\n')
    .map((line) => escapeInline(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Remove Markdown backslash escapes (`\*` → `*`) and collapse whitespace: a plain line. */
export function unescapeInline(text: string): string {
  return text
    .replace(/\\([!-/:-@[-`{-~])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A link or image destination with spaces, parentheses, angle brackets and backslashes encoded. */
export function linkTarget(url: string): string {
  return stripHidden(url).replace(
    /[\s()<>\\]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
  );
}

/** A code fence longer than any backtick run inside `text` (at least three). */
export function fenceFor(text: string): string {
  let longest = 0;
  let run = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '`') {
      run++;
      if (run > longest) longest = run;
    } else run = 0;
  }
  return '`'.repeat(Math.max(3, longest + 1));
}

/** Inline code with a delimiter longer than any backtick run inside. */
export function inlineCode(text: string): string {
  const body = stripHidden(text).replace(/\s+/g, ' ');
  const tick = fenceFor(body).slice(2);
  const pad = body.startsWith('`') || body.endsWith('`') ? ' ' : '';
  return `${tick}${pad}${body}${pad}${tick}`;
}

/**
 * Markdown from data (a text block written in JSON) made inert for a text
 * twin: hidden characters removed and every `<` that could open a tag
 * escaped, so the twin never carries raw HTML.
 */
export function inertMarkdown(markdown: string): string {
  return stripHidden(markdown).replace(/<(?=[A-Za-z/!?])/g, '\\<');
}

/** Link schemes a text twin keeps: `https:`, `http:` and `mailto:`. */
const SAFE_LINK_SCHEME = /^(?:https?:\/\/|mailto:)/i;

/**
 * True when a Markdown link destination is safe to keep in a text twin: an
 * `https:`, `http:` or `mailto:` URL, an empty target, a `#fragment` or a
 * relative path. A relative target is refused when anything before its
 * query or fragment could become a scheme once a renderer decodes it (a
 * `:`, an `&` entity, a `\` escape or whitespace), and protocol-relative
 * `//host` targets are refused.
 */
export function isSafeLinkTarget(url: string): boolean {
  const target = stripHidden(url);
  if (target === '' || target.startsWith('#')) return true;
  if (SAFE_LINK_SCHEME.test(target)) return true;
  if (target.startsWith('//')) return false;
  let end = 0;
  while (end < target.length && target[end] !== '?' && target[end] !== '#') end++;
  return !/[:&\\\s]/.test(target.slice(0, end));
}

/** CommonMark's limit on nested parentheses inside a bare link destination. */
const LINK_PAREN_DEPTH = 32;

const isBlank = (char: string | undefined) => char === ' ' || char === '\t';
const isSpaceChar = (char: string | undefined) => char !== undefined && /\s/.test(char);

/** The key of the "next stop character" table (see `Delimiters.stop`). */
const STOP = 'stop';

/**
 * For each delimiter, the index of its next unescaped occurrence at or after
 * every position (`text.length` when none), built in one backward pass so
 * every lookahead of the neutralizer is O(1) and the whole pass stays linear.
 */
class Delimiters {
  readonly #text: string;
  readonly #escaped: Uint8Array;
  readonly #next = new Map<string, Int32Array>();
  constructor(text: string) {
    this.#text = text;
    this.#escaped = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\\' && !this.#escaped[i] && i + 1 < text.length) this.#escaped[i + 1] = 1;
    }
  }
  escaped(at: number): boolean {
    return this.#escaped[at] === 1;
  }
  /** The next `:`, `&`, `\\`, `?`, `#` or whitespace at or after `from`. */
  stop(from: number): number {
    return this.next(STOP, from);
  }
  next(char: string, from: number): number {
    let table = this.#next.get(char);
    if (!table) {
      const text = this.#text;
      table = new Int32Array(text.length + 1);
      table[text.length] = text.length;
      for (let i = text.length - 1; i >= 0; i--) {
        const hit =
          char === STOP
            ? /[:&\\?#\s]/.test(text[i] as string)
            : text[i] === char && !this.#escaped[i];
        table[i] = hit ? i : (table[i + 1] as number);
      }
      this.#next.set(char, table);
    }
    return from >= this.#text.length ? this.#text.length : (table[from] as number);
  }
}

/**
 * A link destination starting at `from` (after the opening `(` and any
 * spaces): `<…>` on one line, or a bare run with at most 32 nested
 * parentheses. `null` when it is not a destination.
 */
function readDestination(
  text: string,
  from: number,
  marks: Delimiters
): { from: number; to: number; end: number } | null {
  if (text[from] === '<') {
    const close = marks.next('>', from + 1);
    if (close >= text.length || marks.next('\n', from + 1) < close) return null;
    return { from: from + 1, to: close, end: close + 1 };
  }
  let j = from;
  let depth = 0;
  while (j < text.length) {
    const c = text[j] as string;
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (isSpaceChar(c)) break;
    if (c === '(') {
      depth++;
      if (depth > LINK_PAREN_DEPTH) return null;
    } else if (c === ')') {
      if (depth === 0) break;
      depth--;
    }
    j++;
  }
  const end = Math.min(j, text.length);
  return { from, to: end, end };
}

/**
 * `isSafeLinkTarget` for `text[from, to)` in O(1), without slicing: the
 * neutralizer runs it once per `](` and `]:`.
 */
function safeRange(text: string, from: number, to: number, marks: Delimiters): boolean {
  if (from >= to || text[from] === '#') return true;
  // A safe scheme prefix holds no whitespace, `)` or `>`, so it never crosses `to`.
  if (SAFE_LINK_SCHEME.test(text.slice(from, from + 8))) return true;
  if (text[from] === '/' && text[from + 1] === '/' && from + 1 < to) return false;
  const stop = marks.stop(from);
  return stop >= to || text[stop] === '?' || text[stop] === '#';
}

/**
 * A reference definition's destination starting at `from`: up to the next
 * whitespace, or inside `<…>`. Found through the stop table so a run of
 * definitions stays linear; `null` when it is not a destination.
 */
function definitionRange(
  text: string,
  from: number,
  marks: Delimiters
): { from: number; to: number } | null {
  if (text[from] === '<') {
    const close = marks.next('>', from + 1);
    if (close >= text.length || marks.next('\n', from + 1) < close) return null;
    return { from: from + 1, to: close };
  }
  // Only the part up to the first stop character decides safety (see
  // `safeRange`): whitespace ends the destination, anything else is inside it.
  const stop = marks.stop(from);
  return { from, to: stop < text.length && !isSpaceChar(text[stop]) ? stop + 1 : stop };
}

/** The index after the `)` that closes an inline link whose destination ends at `from`. */
function closeOfLink(text: string, from: number, marks: Delimiters): number | null {
  let j = from;
  while (isSpaceChar(text[j])) j++;
  const open = text[j];
  if (open === '"' || open === "'" || open === '(') {
    j = marks.next(open === '(' ? ')' : open, j + 1);
    if (j >= text.length) return null;
    j++;
    while (isSpaceChar(text[j])) j++;
  }
  return text[j] === ')' ? j + 1 : null;
}

/** Skip spaces and tabs, then at most one line break and its indent. */
function skipLinkSpace(text: string, from: number): number {
  let j = from;
  while (isBlank(text[j])) j++;
  if (text[j] === '\n') {
    j++;
    while (isBlank(text[j])) j++;
  }
  return j;
}

/**
 * Markdown with every unsafe link target neutralized (see
 * `isSafeLinkTarget`), for the one-way text twins: an inline link or image
 * keeps its label and loses `[`, `]` and the destination
 * (`[docs](javascript:x)` → `docs`), a reference definition with an unsafe
 * destination, or none on its own line, is broken (`[ref\]: …`, so no link
 * uses it), and a `](` whose
 * link cannot be delimited has its `(` escaped. Safe links stay as written.
 * Hidden characters are removed first, so none can hide a scheme. One pass
 * with O(1) delimiter lookahead (linear in the text length).
 */
export function neutralizeLinks(markdown: string): string {
  const text = stripHidden(markdown);
  if (!text.includes(']')) return text;
  const marks = new Delimiters(text);
  const openers: number[] = [];
  const cuts: [number, number][] = [];
  const escapes: number[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '[') {
      openers.push(i);
      i++;
      continue;
    }
    if (c !== ']') {
      i++;
      continue;
    }
    const opener = openers.pop();
    const next = text[i + 1];
    if (next === ':') {
      // A definition: its destination must sit on the same line (a container
      // prefix such as `> ` could hide one on the next line) and be safe.
      let at = i + 2;
      while (isBlank(text[at])) at++;
      const destination =
        at < text.length && text[at] !== '\n' ? definitionRange(text, at, marks) : null;
      if (destination === null || !safeRange(text, destination.from, destination.to, marks))
        escapes.push(i);
      i += 2;
      continue;
    }
    if (next !== '(') {
      i++;
      continue;
    }
    const destination = readDestination(text, skipLinkSpace(text, i + 2), marks);
    if (destination !== null && safeRange(text, destination.from, destination.to, marks)) {
      i += 2;
      continue;
    }
    const end = destination === null ? null : closeOfLink(text, destination.end, marks);
    if (end === null) {
      escapes.push(i + 1);
      i += 2;
      continue;
    }
    if (opener !== undefined) {
      const image = opener > 0 && text[opener - 1] === '!' && !marks.escaped(opener - 1);
      cuts.push([image ? opener - 1 : opener, opener + 1]);
    }
    cuts.push([i, end]);
    i = end;
  }
  if (cuts.length === 0 && escapes.length === 0) return text;
  const edits: [number, number, string][] = [
    ...cuts.map(([from, to]): [number, number, string] => [from, to, '']),
    ...escapes.map((at): [number, number, string] => [at, at, '\\']),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let out = '';
  let start = 0;
  for (const [from, to, insert] of edits) {
    if (from < start) continue;
    out += text.slice(start, from) + insert;
    start = to;
  }
  return out + text.slice(start);
}

/** True when `markdown` holds a link target `neutralizeLinks` would change. */
export function hasUnsafeLink(markdown: string): boolean {
  return neutralizeLinks(markdown) !== stripHidden(markdown);
}

/** Pretty JSON with every hidden character escaped as `\uXXXX`, so it round-trips. */
export function inertJson(value: unknown): string {
  const text = JSON.stringify(value, null, 2) ?? 'null';
  let out = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x1f && isHiddenCode(code)) {
      out += `${text.slice(start, i)}\\u${code.toString(16).padStart(4, '0')}`;
      start = i + 1;
    }
  }
  return start === 0 ? text : out + text.slice(start);
}

/** A slide-id slug from a title: lowercase ASCII letters, digits and single dashes. */
export function slugify(text: string, max = 48): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, max)
    .replace(/-$/, '');
  return slug;
}

/** True when two JSON values are equal (key order ignored). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!jsonEqual(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  const other = Object.keys(right).filter((key) => right[key] !== undefined);
  if (keys.length !== other.length) return false;
  for (const key of keys) {
    if (!Object.hasOwn(right, key) || !jsonEqual(left[key], right[key])) return false;
  }
  return true;
}
