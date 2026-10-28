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
