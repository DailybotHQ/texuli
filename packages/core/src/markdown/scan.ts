/**
 * Character classes and small scanners shared by the CommonMark block and inline parsers
 * (CommonMark 0.31.2). Every scanner here is a hand-written loop or a regular expression that
 * cannot backtrack polynomially, so the parsers stay linear in the source length.
 */
import { decodeEntityName } from './entities.ts';

/** ASCII punctuation: the characters a backslash may escape. */
export function isAsciiPunctuation(code: number): boolean {
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e)
  );
}

export const isSpaceOrTab = (code: number): boolean => code === 0x20 || code === 0x09;

const UNICODE_PUNCTUATION = /[\p{P}\p{S}]/u;
const UNICODE_WHITESPACE = /[\p{Zs}\t\n\f\r]/u;

/** The code point at `index`, or the one ending at `index - 1` when `before` (surrogate aware). */
function charAround(text: string, index: number, before: boolean): string {
  if (before) {
    if (index <= 0) return '\n';
    const low = text.charCodeAt(index - 1);
    if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
      const high = text.charCodeAt(index - 2);
      if (high >= 0xd800 && high <= 0xdbff) return text.slice(index - 2, index);
    }
    return text.charAt(index - 1);
  }
  if (index >= text.length) return '\n';
  const code = text.codePointAt(index) as number;
  return String.fromCodePoint(code);
}

/** Whether the character before (or at) `index` is Unicode whitespace; the text edges count. */
export function whitespaceAround(text: string, index: number, before: boolean): boolean {
  return UNICODE_WHITESPACE.test(charAround(text, index, before));
}

/** Whether the character before (or at) `index` is Unicode punctuation (categories P and S). */
export function punctuationAround(text: string, index: number, before: boolean): boolean {
  const char = charAround(text, index, before);
  if (char.length === 1 && char.charCodeAt(0) < 0x80) return isAsciiPunctuation(char.charCodeAt(0));
  return UNICODE_PUNCTUATION.test(char);
}

/** Length of an entity or numeric character reference at `pos` (`&...;`), or 0. */
export function entityLength(text: string, pos: number): number {
  if (text.charCodeAt(pos) !== 0x26) return 0;
  let i = pos + 1;
  if (text.charCodeAt(i) === 0x23) {
    i++;
    const hex = text.charCodeAt(i) === 0x78 || text.charCodeAt(i) === 0x58;
    if (hex) i++;
    const start = i;
    const max = hex ? 6 : 7;
    while (i - start < max && i < text.length) {
      const c = text.charCodeAt(i);
      const digit =
        (c >= 0x30 && c <= 0x39) || (hex && ((c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66)));
      if (!digit) break;
      i++;
    }
    if (i === start || text.charCodeAt(i) !== 0x3b) return 0;
    return i + 1 - pos;
  }
  const start = i;
  while (i - start < 32 && i < text.length) {
    const c = text.charCodeAt(i);
    const alnum = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
    if (!alnum || (i === start && c <= 0x39)) break;
    i++;
  }
  if (i - start < 2 || text.charCodeAt(i) !== 0x3b) return 0;
  return decodeEntityName(text.slice(start, i)) === undefined ? 0 : i + 1 - pos;
}

/** Decode one reference that {@link entityLength} accepted. */
export function decodeEntity(reference: string): string {
  if (reference.charCodeAt(1) === 0x23) {
    const hex = reference.charCodeAt(2) === 0x78 || reference.charCodeAt(2) === 0x58;
    const code = Number.parseInt(reference.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
    return String.fromCodePoint(code);
  }
  return decodeEntityName(reference.slice(1, -1)) ?? reference;
}

/** Resolve backslash escapes and character references in a string (a URL, title or info). */
export function unescapeString(text: string): string {
  if (text.indexOf('\\') < 0 && text.indexOf('&') < 0) return text;
  let out = '';
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x5c && isAsciiPunctuation(text.charCodeAt(i + 1))) {
      out += text.slice(last, i) + text.charAt(i + 1);
      i++;
      last = i + 1;
    } else if (c === 0x26) {
      const length = entityLength(text, i);
      if (length > 0) {
        out += text.slice(last, i) + decodeEntity(text.slice(i, i + length));
        i += length - 1;
        last = i + 1;
      }
    }
  }
  return out + text.slice(last);
}

/**
 * A link label as matched: strip the brackets, trim, collapse whitespace runs to one space and
 * case-fold (Unicode case folding approximated by lower then upper case, as the reference
 * implementation does).
 */
export function normalizeLabel(label: string): string {
  let collapsed = '';
  let space = false;
  for (let i = 0; i < label.length; i++) {
    const c = label.charCodeAt(i);
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) space = collapsed.length > 0;
    else {
      if (space) collapsed += ' ';
      space = false;
      collapsed += label.charAt(i);
    }
  }
  return collapsed.toLowerCase().toUpperCase();
}

// ---------------------------------------------------------------------------
// Raw HTML (inline and HTML block type 7)

const isAsciiAlpha = (c: number) => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
const isAsciiDigit = (c: number) => c >= 0x30 && c <= 0x39;
/** HTML whitespace as the spec reads it inside tags: space, tab, line endings, form feed. */
const isTagSpace = (c: number) =>
  c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0c;

/**
 * Remembers the next index of a needle from a non-decreasing start, so repeated failed searches
 * (`<!--` with no `-->`, an unclosed quote) cost linear time overall.
 */
export class NextIndex {
  private readonly memo = new Map<string, { from: number; at: number }>();
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  find(needle: string, from: number): number {
    const seen = this.memo.get(needle);
    if (seen && from >= seen.from && (seen.at < 0 || from <= seen.at)) return seen.at;
    const at = this.text.indexOf(needle, from);
    this.memo.set(needle, { from, at });
    return at;
  }
}

/** End of an open tag's attributes and `>` from `i` (after the tag name), or -1. */
function scanOpenTagRest(text: string, i: number, next: NextIndex): number {
  for (;;) {
    let j = i;
    while (j < text.length && isTagSpace(text.charCodeAt(j))) j++;
    const c = text.charCodeAt(j);
    if (c === 0x3e) return j + 1;
    if (c === 0x2f) return text.charCodeAt(j + 1) === 0x3e ? j + 2 : -1;
    // An attribute needs whitespace before it.
    if (j === i) return -1;
    if (!(isAsciiAlpha(c) || c === 0x5f || c === 0x3a)) return -1;
    j++;
    for (;;) {
      const d = text.charCodeAt(j);
      if (
        isAsciiAlpha(d) ||
        isAsciiDigit(d) ||
        d === 0x5f ||
        d === 0x2e ||
        d === 0x3a ||
        d === 0x2d
      )
        j++;
      else break;
    }
    // Optional value: whitespace, `=`, whitespace, value.
    let k = j;
    while (k < text.length && isTagSpace(text.charCodeAt(k))) k++;
    if (text.charCodeAt(k) === 0x3d) {
      k++;
      while (k < text.length && isTagSpace(text.charCodeAt(k))) k++;
      const q = text.charCodeAt(k);
      if (q === 0x22 || q === 0x27) {
        const close = next.find(q === 0x22 ? '"' : "'", k + 1);
        if (close < 0) return -1;
        j = close + 1;
      } else {
        const start = k;
        while (k < text.length) {
          const d = text.charCodeAt(k);
          if (
            d <= 0x20 ||
            d === 0x22 ||
            d === 0x27 ||
            d === 0x3d ||
            d === 0x3c ||
            d === 0x3e ||
            d === 0x60
          )
            break;
          k++;
        }
        if (k === start) return -1;
        j = k;
      }
    }
    i = j;
  }
}

/**
 * Length of a raw HTML tag at `pos` (open tag, closing tag, comment, processing instruction,
 * declaration or CDATA section, CommonMark 0.31.2 §6.6), or 0.
 */
export function htmlTagLength(text: string, pos: number, next: NextIndex): number {
  if (text.charCodeAt(pos) !== 0x3c) return 0;
  const c = text.charCodeAt(pos + 1);
  if (isAsciiAlpha(c)) {
    let i = pos + 2;
    while (
      isAsciiAlpha(text.charCodeAt(i)) ||
      isAsciiDigit(text.charCodeAt(i)) ||
      text.charCodeAt(i) === 0x2d
    )
      i++;
    const end = scanOpenTagRest(text, i, next);
    return end < 0 ? 0 : end - pos;
  }
  if (c === 0x2f) {
    let i = pos + 2;
    if (!isAsciiAlpha(text.charCodeAt(i))) return 0;
    while (
      isAsciiAlpha(text.charCodeAt(i)) ||
      isAsciiDigit(text.charCodeAt(i)) ||
      text.charCodeAt(i) === 0x2d
    )
      i++;
    while (i < text.length && isTagSpace(text.charCodeAt(i))) i++;
    return text.charCodeAt(i) === 0x3e ? i + 1 - pos : 0;
  }
  if (c === 0x3f) {
    const end = next.find('?>', pos + 2);
    return end < 0 ? 0 : end + 2 - pos;
  }
  if (c === 0x21) {
    if (text.startsWith('<!--', pos)) {
      if (text.startsWith('<!-->', pos)) return 5;
      if (text.startsWith('<!--->', pos)) return 6;
      const end = next.find('-->', pos + 4);
      return end < 0 ? 0 : end + 3 - pos;
    }
    if (text.startsWith('<![CDATA[', pos)) {
      const end = next.find(']]>', pos + 9);
      return end < 0 ? 0 : end + 3 - pos;
    }
    if (isAsciiAlpha(text.charCodeAt(pos + 2))) {
      const end = next.find('>', pos + 2);
      return end < 0 ? 0 : end + 1 - pos;
    }
  }
  return 0;
}

/** Whether `line` (from its start) is one complete open or closing tag followed only by whitespace. */
export function isHtmlBlock7Line(line: string): boolean {
  const c = line.charCodeAt(1);
  if (!(isAsciiAlpha(c) || (c === 0x2f && isAsciiAlpha(line.charCodeAt(2))))) return false;
  const length = htmlTagLength(line, 0, new NextIndex(line));
  if (length === 0) return false;
  for (let i = length; i < line.length; i++) if (!isTagSpace(line.charCodeAt(i))) return false;
  return true;
}
