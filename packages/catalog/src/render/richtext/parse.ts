import { safeHref } from '@texuli/core/url-policy';
import type {
  RichTextDiagnostic,
  RichTextDocument,
  RichTextInline,
  RichTextOptions,
  RichTextParagraph,
  RichTextResult,
} from './types.ts';
import { RICHTEXT_LIMITS } from './types.ts';

const ESCAPABLE = /[\\`*_[\]()]/;
/** What `.` refuses to match in a JavaScript regex without the `s` flag. */
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;

/**
 * Parse an untrusted inline Markdown subset into sink-free nodes.
 *
 * Supported: plain text, `**strong**`, `*em*`, `` `code` ``, `[label](href)`,
 * hard breaks (`  \n` or `\\\n`), backslash escapes. Paragraphs split on blank
 * lines. Raw HTML tags stay literal text. Links go through `safeHref`.
 * Nothing produces HTML strings.
 */
export function renderRichText(source: unknown, options: RichTextOptions = {}): RichTextResult {
  const diagnostics: RichTextDiagnostic[] = [];
  const maxSource = options.maxSource ?? RICHTEXT_LIMITS.source;
  const maxDepth = options.maxDepth ?? RICHTEXT_LIMITS.inlineDepth;
  const hrefTrust = options.hrefTrust ?? 'untrusted';

  let text = typeof source === 'string' ? source : String(source ?? '');
  text = text.replace(/\r\n?/g, '\n');
  if (text.length > maxSource) {
    diagnostics.push({
      code: 'source-truncated',
      message: `Source truncated from ${text.length} to ${maxSource} characters.`,
      offset: maxSource,
    });
    text = text.slice(0, maxSource);
  }

  if (hasHtmlLikeTag(text)) {
    diagnostics.push({
      code: 'html-as-text',
      message: 'HTML-like tags are kept as literal text; nothing is interpreted as markup.',
    });
  }

  const rawParagraphs = splitParagraphs(text).slice(0, RICHTEXT_LIMITS.paragraphs);
  const paragraphs: RichTextParagraph[] = rawParagraphs.map((chunk) => ({
    type: 'paragraph',
    children: parseInline(chunk, 0, maxDepth, hrefTrust, diagnostics),
  }));

  const document: RichTextDocument = {
    paragraphs: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', children: [] }],
  };

  return { document, diagnostics };
}

/**
 * True when the text holds `<tag…>` or `</tag…>`: the old `/<\/?[a-zA-Z][^>]*>/`
 * test, read by index. That pattern restarted at every `<` and ran to the end
 * of the text when no `>` followed, so a run of `<a` was quadratic.
 */
function hasHtmlLikeTag(text: string): boolean {
  const lastClose = text.lastIndexOf('>');
  if (lastClose < 0) return false;
  for (let at = text.indexOf('<'); at !== -1 && at < lastClose; at = text.indexOf('<', at + 1)) {
    let letter = at + 1;
    if (!isAsciiLetter(text.charCodeAt(letter))) {
      if (text[letter] !== '/') continue;
      letter += 1;
      if (!isAsciiLetter(text.charCodeAt(letter))) continue;
    }
    // `[^>]*>` holds whenever any `>` comes after the letter.
    if (letter < lastClose) return true;
  }
  return false;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/** Flatten a document to plain text (for search, titles, plain fallbacks). */
export function richTextToPlain(document: RichTextDocument): string {
  return document.paragraphs
    .map((paragraph) => inlinesToPlain(paragraph.children))
    .filter((line) => line.length > 0)
    .join('\n\n');
}

function inlinesToPlain(nodes: readonly RichTextInline[]): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
        out += node.value;
        break;
      case 'break':
        out += '\n';
        break;
      case 'strong':
      case 'em':
      case 'link':
        out += inlinesToPlain(node.children);
        break;
      default:
        break;
    }
  }
  return out;
}

function splitParagraphs(source: string): string[] {
  const lines = source.split('\n');
  const chunks: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    // Soft-join single newlines inside a paragraph with a space; keep hard breaks as markers.
    chunks.push(buf.join('\n'));
    buf = [];
  };
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return chunks;
}

/**
 * Closer lookups for one inline source. Each table is built on first use in
 * one right-to-left pass and answers in constant time; a forward scan per
 * opener made a run of `[`, unclosed `*` or `_`, or an unclosed link target
 * quadratic on 4,000 characters of agent text. Every table encodes the old
 * forward scan exactly: `t[p]` is what that scan returned when started at
 * `p`. A `\` skips the character after it and a newline ends the scan;
 * `hit` decides every other character (`undefined` moves on to `p + 1`).
 */
type InlineScan = (
  key: string,
  from: number,
  hit: (p: number, t: Int32Array) => number | undefined
) => number;

function inlineScan(source: string): InlineScan {
  const tables = new Map<string, Int32Array>();
  return (key, from, hit) => {
    let t = tables.get(key);
    if (!t) {
      // Two spare slots: `p + 2` past the end reads -1 (not found).
      t = new Int32Array(source.length + 2).fill(-1);
      for (let p = source.length - 1; p >= 0; p -= 1) {
        const ch = source[p];
        t[p] =
          ch === '\\'
            ? (t[p + 2] as number)
            : ch === '\n'
              ? -1
              : (hit(p, t) ?? (t[p + 1] as number));
      }
      tables.set(key, t);
    }
    return t[from] ?? -1;
  };
}

function parseInline(
  source: string,
  depth: number,
  maxDepth: number,
  hrefTrust: NonNullable<RichTextOptions['hrefTrust']>,
  diagnostics: RichTextDiagnostic[],
  inLink = false
): RichTextInline[] {
  const out: RichTextInline[] = [];
  const scan = inlineScan(source);
  let codeMiss = Number.POSITIVE_INFINITY;
  let buffer = '';
  const flush = () => {
    if (buffer) {
      out.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';

    // Backslash escapes and hard break.
    if (ch === '\\') {
      const next = source[i + 1] ?? '';
      if (next === '\n') {
        flush();
        out.push({ type: 'break' });
        i += 2;
        continue;
      }
      if (ESCAPABLE.test(next)) {
        buffer += next;
        i += 2;
        continue;
      }
      buffer += ch;
      i += 1;
      continue;
    }

    // Soft newline → space; two or more trailing spaces → hard break. The
    // trailing run is counted from the end (a `/ {2,}$/` test re-read the
    // whole buffer at every newline).
    if (ch === '\n') {
      let kept = buffer.length;
      while (kept > 0 && buffer.charCodeAt(kept - 1) === 32) kept -= 1;
      if (buffer.length - kept >= 2) {
        buffer = buffer.slice(0, kept);
        flush();
        out.push({ type: 'break' });
      } else {
        buffer += ' ';
      }
      i += 1;
      continue;
    }

    // Inline code.
    if (ch === '`') {
      let length = 1;
      while (source[i + length] === '`') length += 1;
      // `i` only grows, so once no run of `length` backticks follows, no
      // longer run follows later either: skip the search. Failed searches
      // then come in falling lengths (at most ~90 at the cap) and a hit is
      // consumed, so the searches stay near linear.
      const close = length < codeMiss ? source.indexOf('`'.repeat(length), i + length) : -1;
      if (close < 0) codeMiss = Math.min(codeMiss, length);
      if (close !== -1) {
        flush();
        let code = source.slice(i + length, close).replace(/\n/g, ' ');
        if (isPaddedCode(code)) code = code.slice(1, -1);
        out.push({ type: 'code', value: code });
        i = close + length;
        continue;
      }
      buffer += source.slice(i, i + length);
      i += length;
      continue;
    }

    // Links: [label](href) — not inside another link.
    if (ch === '[' && !inLink) {
      const link = matchLink(source, i, scan);
      if (link) {
        flush();
        if (depth >= maxDepth) {
          diagnostics.push({
            code: 'depth-capped',
            message: 'Link nesting exceeded the inline depth cap; rendered as text.',
            offset: i,
          });
          buffer += source.slice(i, link.end);
          i = link.end;
          continue;
        }
        const href = safeHref(link.href, hrefTrust);
        const children = parseInline(link.label, depth + 1, maxDepth, hrefTrust, diagnostics, true);
        if (href) {
          out.push({ type: 'link', href, children });
        } else {
          diagnostics.push({
            code: 'link-rejected',
            // The refused URL is never echoed: diagnostics must not carry
            // attacker-chosen text (the frame and sink scan follow the same rule).
            message: 'Link href rejected by the URL policy.',
            offset: i,
          });
          // Keep the visible label as text (never the raw scheme).
          out.push(...children);
        }
        i = link.end;
        continue;
      }
    }

    // Emphasis / strong when depth allows.
    if (depth < maxDepth && (ch === '*' || ch === '_')) {
      const emphasis = matchEmphasis(source, i, scan);
      if (emphasis) {
        flush();
        out.push({
          type: emphasis.type,
          children: parseInline(
            source.slice(emphasis.innerStart, emphasis.innerEnd),
            depth + 1,
            maxDepth,
            hrefTrust,
            diagnostics,
            inLink
          ),
        });
        i = emphasis.end;
        continue;
      }
    } else if (depth >= maxDepth && (ch === '*' || ch === '_')) {
      // Only warn once per run of markers at this depth.
      if (source[i - 1] !== ch) {
        diagnostics.push({
          code: 'depth-capped',
          message: 'Emphasis nesting exceeded the inline depth cap; markers kept as text.',
          offset: i,
        });
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return mergeAdjacentText(out);
}

/**
 * A code span padded with one space on each side (longer than two
 * characters) loses the padding. Same test as `/^ .* $/`: `.` stops at every
 * line terminator, so a newline, CR, U+2028 or U+2029 inside keeps the padding.
 */
function isPaddedCode(code: string): boolean {
  return (
    code.length > 2 &&
    code.charCodeAt(0) === 32 &&
    code.charCodeAt(code.length - 1) === 32 &&
    !LINE_TERMINATOR.test(code)
  );
}

function mergeAdjacentText(nodes: RichTextInline[]): RichTextInline[] {
  const out: RichTextInline[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (node.type === 'text' && prev?.type === 'text') {
      out[out.length - 1] = { type: 'text', value: prev.value + node.value };
    } else {
      out.push(node);
    }
  }
  return out;
}

function matchLink(
  source: string,
  start: number,
  scan: InlineScan
): { label: string; href: string; end: number } | null {
  if (source[start] !== '[') return null;
  // The `]` that balances this `[`; a nested label is skipped whole.
  const labelEnd = scan('label', start + 1, (p, t) => {
    const ch = source[p];
    if (ch === ']') return p;
    if (ch !== '[') return undefined;
    const inner = t[p + 1] as number;
    return inner < 0 ? -1 : (t[inner + 1] as number);
  });
  if (labelEnd < 0 || source[labelEnd + 1] !== '(') return null;
  // The `)` that ends the target; a space ends it unmatched.
  const hrefEnd = scan('href', labelEnd + 2, (p) =>
    source[p] === ')' ? p : source[p] === ' ' ? -1 : undefined
  );
  if (hrefEnd < 0) return null;
  return {
    label: source.slice(start + 1, labelEnd),
    href: source.slice(labelEnd + 2, hrefEnd),
    end: hrefEnd + 1,
  };
}

function matchEmphasis(
  source: string,
  start: number,
  scan: InlineScan
): { type: 'strong' | 'em'; innerStart: number; innerEnd: number; end: number } | null {
  const marker = source[start] ?? '';
  if (marker !== '*' && marker !== '_') return null;
  const next = source[start + 1] ?? '';
  // Strong: ** or __
  if (next === marker) {
    const close = scan(marker + marker, start + 2, (p) =>
      source[p] === marker && source[p + 1] === marker ? p : undefined
    );
    // Unclosed or empty.
    if (close < 0 || close === start + 2) return null;
    return {
      type: 'strong',
      innerStart: start + 2,
      innerEnd: close,
      end: close + 2,
    };
  }
  // Em: * or _ (never closing on the first half of a double marker)
  const close = scan(marker, start + 1, (p, t) =>
    source[p] !== marker ? undefined : source[p + 1] === marker ? (t[p + 2] as number) : p
  );
  if (close < 0 || close === start + 1) return null;
  return {
    type: 'em',
    innerStart: start + 1,
    innerEnd: close,
    end: close + 1,
  };
}
