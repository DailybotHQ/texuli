/**
 * A tolerant, DOM-free HTML tokenizer for untrusted input. It reads start tags (with the few
 * attributes the reader uses), end tags and text, decodes character references, and never builds
 * a DOM or evaluates anything. It is a single forward scan: every `indexOf` starts at the cursor
 * and the cursor only moves forward, so the time is linear in the input.
 *
 * - Comments, doctypes, CDATA and processing instructions are skipped (`<!…>` and `<?…>` end at
 *   the first `>`, `<!--` at the first `-->`, as in a browser).
 * - Raw-text and dropped elements (`RAW_DROPPED`) are skipped with everything up to their end tag:
 *   `script`, `style`, `iframe`, `svg`, `math`, `template`, `textarea` and the rest. `plaintext`
 *   drops the rest of the input.
 * - Only `KEPT_ATTRIBUTES` are kept (first occurrence wins, as in a browser); event handlers,
 *   `style` other than `text-align`, `srcset`, `formaction` and every other attribute are dropped
 *   by construction. Attribute values longer than `HTML_TOKEN_LIMITS.attributeValue` are dropped.
 * - A `<` that starts no tag is text.
 */
import { decodeHtmlEntities } from './entities.ts';

export const HTML_TOKEN_LIMITS = Object.freeze({
  /** Longest tag name kept; longer names are read as an unknown element. */
  tagName: 64,
  /** Attributes scanned per tag; the rest of the tag is skipped. */
  attributes: 64,
  /** Longest attribute value kept (UTF-16 units); a longer value is dropped. */
  attributeValue: 8192,
});

/** Attributes the reader uses. Everything else is dropped while tokenizing. */
export const KEPT_ATTRIBUTES: ReadonlySet<string> = new Set([
  'href',
  'src',
  'alt',
  'title',
  'class',
  'id',
  'start',
  'type',
  'checked',
  'align',
  'style',
  'data-task',
  'data-spoiler',
  'data-mention',
  'data-mention-id',
  'data-footnote-ref',
  'data-footnote-backref',
  'data-footnotes',
]);

/** Elements skipped together with their content. */
export const RAW_DROPPED: ReadonlySet<string> = new Set([
  'script',
  'style',
  'template',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'object',
  'applet',
  'svg',
  'math',
  'head',
  'select',
  'button',
  'frameset',
  'datalist',
  'audio',
  'video',
  'canvas',
  'map',
]);

export type HtmlAttributes = Readonly<Record<string, string>>;

export type HtmlToken =
  | { readonly kind: 'text'; readonly value: string; readonly start: number; readonly end: number }
  | {
      readonly kind: 'start';
      readonly name: string;
      readonly attributes: HtmlAttributes;
      readonly selfClosing: boolean;
      readonly start: number;
      readonly end: number;
    }
  | { readonly kind: 'end'; readonly name: string; readonly start: number; readonly end: number }
  /** A dropped element (`RAW_DROPPED`, or `plaintext`): reported, never read. */
  | {
      readonly kind: 'dropped';
      readonly name: string;
      readonly start: number;
      readonly end: number;
    };

const isAsciiAlpha = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const isSpace = (code: number) =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d;

/** Text as the reader keeps it: NUL becomes U+FFFD (as browsers do). */
function cleanText(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: NUL is the target.
  return value.includes('\u0000') ? value.replace(/\u0000/g, String.fromCharCode(0xfffd)) : value;
}

interface TagRead {
  readonly name: string;
  readonly attributes: Record<string, string>;
  readonly selfClosing: boolean;
  readonly end: number;
}

/** Read a start tag whose name begins at `from` (just after `<`). */
function readStartTag(source: string, lower: string, from: number): TagRead {
  const length = source.length;
  let i = from;
  while (i < length) {
    const code = source.charCodeAt(i);
    if (isSpace(code) || code === 0x2f /* / */ || code === 0x3e /* > */) break;
    i += 1;
  }
  const rawName = lower.slice(from, i);
  const name = rawName.length > HTML_TOKEN_LIMITS.tagName ? 'x-unknown' : rawName;
  const attributes: Record<string, string> = {};
  let selfClosing = false;
  let scanned = 0;
  while (i < length) {
    const code = source.charCodeAt(i);
    if (code === 0x3e) return { name, attributes, selfClosing, end: i + 1 };
    if (isSpace(code) || code === 0x2f) {
      selfClosing = code === 0x2f;
      i += 1;
      continue;
    }
    selfClosing = false;
    // Attribute name: up to whitespace, `/`, `>` or `=` (a leading `=` belongs to the name).
    const nameStart = i;
    i += 1;
    while (i < length) {
      const c = source.charCodeAt(i);
      if (isSpace(c) || c === 0x2f || c === 0x3e || c === 0x3d) break;
      i += 1;
    }
    const attributeName = lower.slice(nameStart, i);
    while (i < length && isSpace(source.charCodeAt(i))) i += 1;
    let value: string | null = null;
    if (source.charCodeAt(i) === 0x3d /* = */) {
      i += 1;
      while (i < length && isSpace(source.charCodeAt(i))) i += 1;
      const quote = source.charCodeAt(i);
      if (quote === 0x22 || quote === 0x27) {
        const close = source.indexOf(quote === 0x22 ? '"' : "'", i + 1);
        const stop = close === -1 ? length : close;
        value = source.slice(i + 1, stop);
        i = stop === length ? length : stop + 1;
      } else {
        const valueStart = i;
        while (i < length) {
          const c = source.charCodeAt(i);
          if (isSpace(c) || c === 0x3e) break;
          i += 1;
        }
        value = source.slice(valueStart, i);
      }
    }
    scanned += 1;
    if (scanned > HTML_TOKEN_LIMITS.attributes) continue;
    if (!KEPT_ATTRIBUTES.has(attributeName) || Object.hasOwn(attributes, attributeName)) continue;
    if (value !== null && value.length > HTML_TOKEN_LIMITS.attributeValue) continue;
    attributes[attributeName] = value === null ? '' : cleanText(decodeHtmlEntities(value));
  }
  // An unclosed tag at the end of input is dropped, as browsers do.
  return { name: '', attributes, selfClosing, end: length };
}

/**
 * Tokenize untrusted HTML. Never throws; a non-string input gives no tokens. CRLF and CR become
 * LF before reading, so offsets are into that normalized string.
 */
export function tokenizeHtml(input: string): HtmlToken[] {
  if (typeof input !== 'string') return [];
  const source = input.includes('\r') ? input.replace(/\r\n?/g, '\n') : input;
  const lower = source.toLowerCase();
  const length = source.length;
  const tokens: HtmlToken[] = [];
  let i = 0;
  let textStart = 0;
  const flush = (end: number) => {
    if (end > textStart)
      tokens.push({
        kind: 'text',
        value: cleanText(decodeHtmlEntities(source.slice(textStart, end))),
        start: textStart,
        end,
      });
  };
  while (i < length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) break;
    const next = source.charCodeAt(lt + 1);
    if (next === 0x21 /* ! */ || next === 0x3f /* ? */) {
      flush(lt);
      if (source.startsWith('<!--', lt)) {
        // `<!-->` and `<!--->` close at once, as in a browser.
        const abrupt = source.startsWith('<!-->', lt) ? 5 : source.startsWith('<!--->', lt) ? 6 : 0;
        if (abrupt > 0) i = lt + abrupt;
        else {
          const close = source.indexOf('-->', lt + 4);
          i = close === -1 ? length : close + 3;
        }
      } else {
        const close = source.indexOf('>', lt + 2);
        i = close === -1 ? length : close + 1;
      }
      textStart = i;
      continue;
    }
    if (next === 0x2f /* / */) {
      const after = source.charCodeAt(lt + 2);
      if (isAsciiAlpha(after)) {
        flush(lt);
        let end = lt + 2;
        while (end < length) {
          const c = source.charCodeAt(end);
          if (isSpace(c) || c === 0x2f || c === 0x3e) break;
          end += 1;
        }
        const close = source.indexOf('>', end);
        i = close === -1 ? length : close + 1;
        if (close !== -1)
          tokens.push({ kind: 'end', name: lower.slice(lt + 2, end), start: lt, end: i });
        textStart = i;
        continue;
      }
      if (after === 0x3e /* </> is ignored */) {
        flush(lt);
        i = lt + 3;
        textStart = i;
        continue;
      }
      if (lt + 2 < length) {
        // `</` + anything else is a bogus comment up to `>`.
        flush(lt);
        const close = source.indexOf('>', lt + 2);
        i = close === -1 ? length : close + 1;
        textStart = i;
        continue;
      }
      i = lt + 1;
      continue;
    }
    if (isAsciiAlpha(next)) {
      flush(lt);
      const tag = readStartTag(source, lower, lt + 1);
      i = tag.end;
      textStart = i;
      if (tag.name === '') continue;
      if (tag.name === 'plaintext') {
        tokens.push({ kind: 'dropped', name: tag.name, start: lt, end: length });
        i = length;
        textStart = length;
        break;
      }
      if (RAW_DROPPED.has(tag.name)) {
        let end = length;
        if (!tag.selfClosing || tag.name === 'script' || tag.name === 'style') {
          const close = lower.indexOf(`</${tag.name}`, i);
          if (close !== -1) {
            const gt = source.indexOf('>', close);
            end = gt === -1 ? length : gt + 1;
          }
        } else end = i;
        tokens.push({ kind: 'dropped', name: tag.name, start: lt, end });
        i = end;
        textStart = i;
        continue;
      }
      tokens.push({
        kind: 'start',
        name: tag.name,
        attributes: tag.attributes,
        selfClosing: tag.selfClosing,
        start: lt,
        end: i,
      });
      continue;
    }
    i = lt + 1;
  }
  flush(length);
  return tokens;
}
