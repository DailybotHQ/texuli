/**
 * GFM extended autolinks (GFM §6.9, as cmark-gfm 0.29 reads them): `www.` and `http://`,
 * `https://` and `ftp://` links found while parsing inlines, and email, `mailto:` and `xmpp:`
 * links found afterwards in plain text. Every scan is a single forward pass (trailing
 * parentheses are counted once), so a long run stays linear.
 */

const UNICODE_PUNCTUATION = /\p{P}/u;
const UNICODE_SPACE = /\s/u;
const MAX_DOMAIN = 255;

const isAsciiAlnum = (c: number) =>
  (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
const isAsciiAlpha = (c: number) => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
const isSpace = (c: number) =>
  c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0c || c === 0x0b;

/** Whether the character before an autolink allows it: none, whitespace, `*`, `_`, `~` or `(`. */
export function autolinkBoundary(text: string, index: number): boolean {
  if (index <= 0) return true;
  const c = text.charCodeAt(index - 1);
  return isSpace(c) || c === 0x2a || c === 0x5f || c === 0x7e || c === 0x28;
}

/** A host character: not whitespace and not Unicode punctuation (`-` and `_` are checked apart). */
function isHostChar(text: string, index: number): boolean {
  const code = text.codePointAt(index) as number;
  // ASCII: letters and digits (ASCII punctuation, spaces and controls end a host).
  if (code < 0x80) return isAsciiAlnum(code);
  const char = String.fromCodePoint(code);
  return !UNICODE_SPACE.test(char) && !UNICODE_PUNCTUATION.test(char);
}

/**
 * The length of a valid domain at `start` (cmark-gfm `check_domain`): segments of host
 * characters, `-` and `_` separated by `.`, with no `_` in the last two segments; `www.` links
 * need at least one period. Returns 0 when invalid.
 */
function domainLength(text: string, start: number, end: number, allowShort: boolean): number {
  let periods = 0;
  let underscoresLast = 0;
  let underscoresPrevious = 0;
  let i = start + 1;
  // A host name has at most 253 characters (DNS): the cap keeps repeated failed scans linear.
  const stop = Math.min(end - 1, start + MAX_DOMAIN);
  for (; i < stop; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x5c && i < end - 2) i++;
    const d = text.charCodeAt(i);
    if (d === 0x5f) underscoresLast++;
    else if (d === 0x2e) {
      underscoresPrevious = underscoresLast;
      underscoresLast = 0;
      periods++;
    } else if (d !== 0x2d && !isHostChar(text, i)) break;
    if (d >= 0xd800 && d <= 0xdbff) i++;
  }
  if (underscoresPrevious > 0 || underscoresLast > 0) return 0;
  if (!allowShort && periods === 0) return 0;
  return i - start;
}

/**
 * Trim trailing characters that end a sentence rather than a link (cmark-gfm `autolink_delim`):
 * `?!.,:*_~'"`, an entity-like `&name;`, and `)` beyond the balanced ones. Returns the new end.
 */
export function autolinkDelimiter(text: string, start: number, end: number): number {
  let linkEnd = end;
  for (let i = start; i < linkEnd; i++)
    if (text.charCodeAt(i) === 0x3c) {
      linkEnd = i;
      break;
    }
  let opening = -1;
  let closing = -1;
  while (linkEnd > start) {
    const c = text.charCodeAt(linkEnd - 1);
    if (
      c === 0x3f ||
      c === 0x21 ||
      c === 0x2e ||
      c === 0x2c ||
      c === 0x3a ||
      c === 0x2a ||
      c === 0x5f ||
      c === 0x7e ||
      c === 0x27 ||
      c === 0x22
    )
      linkEnd--;
    else if (c === 0x3b) {
      let back = linkEnd - 2;
      while (back > start && isAsciiAlpha(text.charCodeAt(back))) back--;
      if (back < linkEnd - 2 && text.charCodeAt(back) === 0x26) linkEnd = back;
      else linkEnd--;
    } else if (c === 0x29) {
      if (opening < 0) {
        opening = 0;
        closing = 0;
        for (let i = start; i < linkEnd; i++) {
          const d = text.charCodeAt(i);
          if (d === 0x28) opening++;
          else if (d === 0x29) closing++;
        }
      }
      if (closing <= opening) break;
      linkEnd--;
      closing--;
    } else break;
  }
  return linkEnd;
}

/** End of the path that follows a domain: up to whitespace or `<`. */
function pathEnd(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (isSpace(c) || c === 0x3c) break;
    i++;
  }
  return i;
}

/**
 * A `www.` autolink at `pos` (the caller checked the boundary before it): its end, or 0. The
 * link's URL is `http://` plus its text.
 */
export function wwwAutolinkEnd(text: string, pos: number): number {
  if (!text.startsWith('www.', pos)) return 0;
  // Like cmark-gfm, the domain scan stops at the first non-host character.
  if (domainLength(text, pos, text.length, false) === 0) return 0;
  const end = autolinkDelimiter(text, pos, pathEnd(text, pos));
  return end > pos ? end : 0;
}

const SCHEMES = ['https', 'http', 'ftp'] as const;

/**
 * A `scheme://` autolink whose `:` is at `colon` (cmark-gfm `url_match`): the scheme is the whole
 * run of ASCII letters before the colon and must be http, https or ftp (any case). Returns the
 * scheme's start and the link's end, or `null`.
 */
export function urlAutolink(
  text: string,
  colon: number
): { readonly start: number; readonly end: number } | null {
  if (!text.startsWith('://', colon)) return null;
  let start = colon;
  while (start > 0 && colon - start < 6 && isAsciiAlpha(text.charCodeAt(start - 1))) start--;
  if (start > 0 && isAsciiAlpha(text.charCodeAt(start - 1))) return null;
  const scheme = text.slice(start, colon).toLowerCase();
  if (!(SCHEMES as readonly string[]).includes(scheme)) return null;
  const hostStart = colon + 3;
  if (hostStart >= text.length || domainLength(text, hostStart, text.length, true) === 0)
    return null;
  const limit = pathEnd(text, hostStart);
  if (limit <= hostStart) return null;
  const end = autolinkDelimiter(text, start, limit);
  return end > hostStart ? { start, end } : null;
}

export type AutolinkPiece =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'link'; readonly url: string; readonly value: string };

/** Whether `protocol` (`mailto:`, `xmpp:`) ends at `end` in `text`, after `from`, not after a letter or digit. */
function protocolAt(text: string, from: number, end: number, protocol: string): boolean {
  const start = end - protocol.length;
  if (start < from || text.slice(start, end) !== protocol) return false;
  return start === from || !isAsciiAlnum(text.charCodeAt(start - 1));
}

/**
 * Split plain text into text and email, `mailto:` and `xmpp:` links (cmark-gfm's post-pass).
 * Returns `null` when the text holds no such link.
 */
export function emailAutolinks(text: string): AutolinkPiece[] | null {
  if (text.indexOf('@') < 0) return null;
  const pieces: AutolinkPiece[] = [];
  let start = 0;
  let offset = 0;
  for (;;) {
    const at = text.indexOf('@', start + offset);
    if (at < 0) break;
    const from = start + offset;
    let rewind = 0;
    let mailto = true;
    let xmpp = false;
    for (; rewind < at - from; rewind++) {
      const index = at - rewind - 1;
      const c = text.charCodeAt(index);
      if (isAsciiAlnum(c) || c === 0x2e || c === 0x2b || c === 0x2d || c === 0x5f) continue;
      if (c === 0x3a) {
        if (protocolAt(text, from, index + 1, 'mailto:')) {
          mailto = false;
          continue;
        }
        if (protocolAt(text, from, index + 1, 'xmpp:')) {
          mailto = false;
          xmpp = true;
          continue;
        }
      }
      break;
    }
    if (rewind === 0) {
      offset = at + 1 - start;
      continue;
    }
    let ats = 0;
    let periods = 0;
    let linkEnd = 0;
    for (; at + linkEnd < text.length; linkEnd++) {
      const c = text.charCodeAt(at + linkEnd);
      if (isAsciiAlnum(c)) continue;
      if (c === 0x40) ats++;
      else if (
        c === 0x2e &&
        at + linkEnd + 1 < text.length &&
        isAsciiAlnum(text.charCodeAt(at + linkEnd + 1))
      )
        periods++;
      else if (c === 0x2f && xmpp) continue;
      else if (c !== 0x2d && c !== 0x5f) break;
    }
    const last = text.charCodeAt(at + linkEnd - 1);
    if (linkEnd < 2 || ats !== 1 || periods === 0 || (!isAsciiAlpha(last) && last !== 0x2e)) {
      offset = at + Math.max(linkEnd, 1) - start;
      continue;
    }
    const end = autolinkDelimiter(text, at, at + linkEnd);
    if (end <= at) {
      offset = at + 1 - start;
      continue;
    }
    const linkStart = at - rewind;
    if (linkStart > start) pieces.push({ kind: 'text', value: text.slice(start, linkStart) });
    const value = text.slice(linkStart, end);
    pieces.push({ kind: 'link', url: mailto ? `mailto:${value}` : value, value });
    start = end;
    offset = 0;
  }
  if (pieces.length === 0) return null;
  if (start < text.length) pieces.push({ kind: 'text', value: text.slice(start) });
  return pieces;
}
