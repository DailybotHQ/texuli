import { safeHref } from '@texuli/core';

/**
 * Owned, closed Markdown subset for text blocks (T-blocks-text). It turns
 * already-validated block text into a small tree the Svelte renderers walk.
 * Nothing here produces HTML: raw tags stay literal text, every link goes
 * through `safeHref` (untrusted tier), and images render as their alt text
 * (pictures belong to the media family, which applies `safeImageSrc`).
 *
 * Supported: paragraphs, `#` headings, `-`/`*`/`+` and `1.` lists (nested by
 * indentation, `[ ]`/`[x]` task items), `>` quotes, fenced code, thematic
 * breaks; inline `**strong**`, `*em*`, `~~del~~`, `` `code` ``, `[text](href)`,
 * `<https://…>` autolinks, backslash escapes and hard breaks.
 */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'break' }
  | { type: 'strong' | 'em' | 'del'; children: MdInline[] }
  | { type: 'link'; href: string | undefined; children: MdInline[] };

export type MdListItem = { checked: boolean | null; children: MdBlock[] };

export type MdBlock =
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { type: 'list'; ordered: boolean; start: number; items: MdListItem[] }
  | { type: 'quote'; children: MdBlock[] }
  | { type: 'code'; lang: string | undefined; text: string }
  | { type: 'rule' };

export interface MdDocument {
  blocks: MdBlock[];
}

/** Nesting and size caps: hostile input degrades to literal text, never recursion blowups. */
export const MARKDOWN_LIMITS = /* @__PURE__ */ Object.freeze({
  /**
   * Longest source parsed, equal to the schema's markdown cap. Pathological
   * inline input stays under ~50 ms at this size.
   */
  source: 4_000,
  /** Nested quotes and lists. */
  blockDepth: 4,
  /** Nested emphasis and links. */
  inlineDepth: 6,
});

// Line readers stay linear on hostile lines (every text field allows 4,000
// characters of untrusted agent text). Heading, fence and rule lines are read
// by hand: their regex forms had neighboring quantifiers over the same spaces
// and backtracked quadratically or worse (`# a` + 2,000 spaces + `x` took over
// 20 s). The remaining patterns are anchored, their quantifiers never overlap,
// and `.` uses the `s` flag so a stray line separator never makes a `(.*)$`
// tail backtrack.
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_LANG = /^[a-z][a-z0-9+-]{0,31}$/i;
const QUOTE = /^ {0,3}> ?(.*)$/s;
const BULLET = /^( {0,3})([-*+])[ \t]+(.*)$/s;
const ORDERED = /^( {0,3})(\d{1,9})[.)][ \t]+(.*)$/s;
const TASK = /^\[([ xX])\][ \t]+/;

/** Parses validated block text into the closed Markdown tree. */
export function parseMarkdown(source: string): MdDocument {
  // CR LF, CR, U+2028 and U+2029 all end a line: JavaScript regexes treat the
  // last two as line terminators, so no line may keep one.
  const text = String(source)
    .slice(0, MARKDOWN_LIMITS.source)
    .replace(/\r\n?|[\u2028\u2029]/g, '\n');
  return { blocks: parseBlocks(text.split('\n'), 0) };
}

const isSpace = (char: string | undefined) => char === ' ' || char === '\t';

/** Leading spaces (not tabs), counted up to `max + 1`. */
function indentOf(line: string, max: number): number {
  let n = 0;
  while (n <= max && line[n] === ' ') n += 1;
  return n;
}

/** A fence opening line: its marker and the optional language. */
function readFence(line: string): { marker: string; lang: string | undefined } | null {
  const open = FENCE_OPEN.exec(line);
  if (!open) return null;
  const info = line.slice(open[0].length).trim();
  if (info !== '' && !FENCE_LANG.test(info)) return null;
  return { marker: open[1] as string, lang: info ? info.toLowerCase() : undefined };
}

/**
 * An ATX heading line, read the way the old pattern did: up to six `#` (a
 * seventh or later reads as part of the closing run), then text after a space
 * or tab, with trailing spaces, the closing `#` run and the spaces before it
 * dropped from the end. Index scans only: linear in the line.
 */
function readHeading(line: string): { level: 1 | 2 | 3 | 4 | 5 | 6; text: string } | null {
  const indent = indentOf(line, 3);
  if (indent > 3 || line[indent] !== '#') return null;
  let at = indent;
  while (at < indent + 6 && line[at] === '#') at += 1;
  const level = (at - indent) as 1 | 2 | 3 | 4 | 5 | 6;
  const rest = line.slice(at);
  let start = 0;
  while (isSpace(rest[start])) start += 1;
  let end = rest.length;
  while (end > start && isSpace(rest[end - 1])) end -= 1;
  while (end > start && rest[end - 1] === '#') end -= 1;
  while (end > start && isSpace(rest[end - 1])) end -= 1;
  // Without a space or tab after the opening run, only a closing run may follow.
  if (start === 0 && end > 0) return null;
  return { level, text: rest.slice(start, end) };
}

/** A thematic break: three or more of one of `-`, `*` or `_`, spaces and tabs between. */
function isRule(line: string): boolean {
  const at = indentOf(line, 3);
  if (at > 3) return false;
  const marker = line[at];
  if (marker !== '-' && marker !== '*' && marker !== '_') return false;
  let count = 0;
  for (let i = at; i < line.length; i += 1) {
    const char = line[i];
    if (char === marker) count += 1;
    else if (!isSpace(char)) return false;
  }
  return count >= 3;
}

/** Two or more leading spaces, then a non-whitespace character. */
function isIndented(line: string): boolean {
  let at = 0;
  while (line[at] === ' ') at += 1;
  return at >= 2 && at < line.length && /\S/.test(line[at] as string);
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function listMarker(line: string): { ordered: boolean; start: number; content: string } | null {
  const bullet = BULLET.exec(line);
  if (bullet) return { ordered: false, start: 1, content: bullet[3] ?? '' };
  const ordered = ORDERED.exec(line);
  if (ordered) return { ordered: true, start: Number(ordered[2]), content: ordered[3] ?? '' };
  return null;
}

/** True when `line` starts a block other than a paragraph continuation. */
function startsBlock(line: string): boolean {
  return (
    readFence(line) !== null ||
    readHeading(line) !== null ||
    isRule(line) ||
    QUOTE.test(line) ||
    listMarker(line) !== null
  );
}

function parseBlocks(lines: readonly string[], depth: number): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const fence = readFence(line);
    if (fence) {
      const marker = fence.marker;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith(marker)) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // closing fence (or end of input)
      blocks.push({ type: 'code', lang: fence.lang, text: body.join('\n') });
      continue;
    }

    const heading = readHeading(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading.level,
        children: parseInline(heading.text, 0),
      });
      i += 1;
      continue;
    }

    if (isRule(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? '')) {
        inner.push(QUOTE.exec(lines[i] ?? '')?.[1] ?? '');
        i += 1;
      }
      blocks.push(
        depth < MARKDOWN_LIMITS.blockDepth
          ? { type: 'quote', children: parseBlocks(inner, depth + 1) }
          : { type: 'paragraph', children: parseInline(inner.join('\n'), 0) }
      );
      continue;
    }

    const marker = listMarker(line);
    if (marker) {
      const parsed = parseList(lines, i, marker.ordered, marker.start, depth);
      blocks.push(parsed.block);
      i = parsed.next;
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && !isBlank(lines[i] ?? '') && !startsBlock(lines[i] ?? '')) {
      paragraph.push(lines[i] ?? '');
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n'), 0) });
  }
  return blocks;
}

function parseList(
  lines: readonly string[],
  from: number,
  ordered: boolean,
  start: number,
  depth: number
): { block: MdBlock; next: number } {
  const items: MdListItem[] = [];
  let i = from;
  while (i < lines.length) {
    const marker = listMarker(lines[i] ?? '');
    if (!marker || marker.ordered !== ordered) break;
    const body: string[] = [marker.content];
    i += 1;
    // Continuation: indented lines (nested lists, wrapped text) and lazy
    // paragraph lines that do not start another block.
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (isBlank(next)) {
        const after = lines[i + 1] ?? '';
        if (isIndented(after)) {
          body.push('');
          i += 1;
          continue;
        }
        break;
      }
      if (isIndented(next)) {
        body.push(next.replace(/^ {2,4}/, ''));
        i += 1;
        continue;
      }
      if (startsBlock(next)) break;
      body.push(next);
      i += 1;
    }
    let checked: boolean | null = null;
    const task = TASK.exec(body[0] ?? '');
    if (task) {
      checked = task[1] !== ' ';
      body[0] = (body[0] ?? '').slice(task[0].length);
    }
    const children =
      depth < MARKDOWN_LIMITS.blockDepth
        ? parseBlocks(body, depth + 1)
        : [{ type: 'paragraph' as const, children: parseInline(body.join('\n'), 0) }];
    items.push({ checked, children });
  }
  return { block: { type: 'list', ordered, start, items }, next: i };
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~<>|]/;
const AUTOLINK = /<((?:https?:\/\/|mailto:)[^\s<>]+)>/iy;

const isWhitespace = (char: string | undefined) => char !== undefined && /\s/.test(char);
/** A target character: not whitespace, a parenthesis or an angle bracket. */
const isTargetChar = (char: string | undefined) => char !== undefined && !/[\s()<>]/.test(char);

/**
 * Reads a link target `(<href> "title")` whose `(` is at `open`, by hand.
 * It returns what `/\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))*)>?(?:\s+"[^"\n]*")?\s*\)/y`
 * returned (the href and the index after `)`), but in linear time: in that
 * regex `\(\s*`, `\s+"` and `\s*\)` competed for one whitespace run, so
 * `[a](` + 3,990 spaces + `x` took about 250 ms.
 */
function readLinkTarget(source: string, open: number): { href: string; end: number } | null {
  // The optional title and the closing parenthesis from `from`: the index
  // after `)`, or -1.
  const close = (from: number) => {
    let at = from;
    while (isWhitespace(source[at])) at += 1;
    if (source[at] === ')') return at + 1;
    if (at === from || source[at] !== '"') return -1;
    at += 1;
    while (at < source.length && source[at] !== '"' && source[at] !== '\n') at += 1;
    if (source[at] !== '"') return -1;
    at += 1;
    while (isWhitespace(source[at])) at += 1;
    return source[at] === ')' ? at + 1 : -1;
  };
  let at = open + 1;
  while (isWhitespace(source[at])) at += 1;
  const afterSpace = at;
  if (source[at] === '<') at += 1;
  const hrefStart = at;
  // Plain characters and balanced `(…)` groups without whitespace inside.
  for (;;) {
    if (isTargetChar(source[at])) at += 1;
    else if (source[at] === '(') {
      let inner = at + 1;
      while (isTargetChar(source[inner])) inner += 1;
      if (source[inner] !== ')') break;
      at = inner + 1;
    } else break;
  }
  const href = source.slice(hrefStart, at);
  if (source[at] === '>') at += 1;
  const end = close(at);
  if (end !== -1) return { href, end };
  // The regex backtracked into the leading whitespace: `( "title")` is an
  // empty href with a title.
  if (afterSpace > open + 1) {
    const titled = close(open + 1);
    if (titled !== -1) return { href: '', end: titled };
  }
  return null;
}

type EmphasisMarker = '**' | '__' | '~~' | '*' | '_';

type InlineScan = {
  /** The first closing `marker` at or after `from`, or -1. */
  closer: (marker: EmphasisMarker, from: number) => number;
  /** The `]` that balances the `[` at `at`, or -1. */
  labelEnd: (at: number) => number;
};

/**
 * Closer and bracket lookups for one inline source, each table built on
 * first use in one pass. A forward scan per opener made a run of unclosed
 * `*`, `_`, `~~` or `[` quadratic; with the tables every lookup is constant
 * time and a parse stays linear in the source.
 */
function inlineScan(source: string): InlineScan {
  const n = source.length;
  const closers = new Map<EmphasisMarker, Int32Array>();
  let labels: Int32Array | undefined;
  return {
    // The old forward search, right to left: a closer is not after whitespace
    // or a backslash, not doubled (`*` before `*`) and not inside a word (`_`);
    // a rejected doubled marker skips its twin.
    closer(marker, from) {
      let table = closers.get(marker);
      if (!table) {
        table = new Int32Array(n + 3).fill(-1);
        for (let p = n - 1; p >= 0; p -= 1) {
          if (!source.startsWith(marker, p)) {
            table[p] = table[p + 1] as number;
            continue;
          }
          const before = source[p - 1] ?? '';
          const after = source[p + marker.length] ?? '';
          const doubled = marker.length === 1 && after === marker;
          table[p] =
            !/\s/.test(before) &&
            before !== '\\' &&
            !doubled &&
            !(marker[0] === '_' && /[\p{L}\p{N}]/u.test(after))
              ? p
              : (table[p + (doubled ? 2 : 1)] as number);
        }
        closers.set(marker, table);
      }
      return from < n ? (table[from] as number) : -1;
    },
    // Brackets balance on a stack; escaped characters are skipped (an escaped
    // `[` never opens, and the inline loop never reaches one), and a blank
    // line closes every open label.
    labelEnd(at) {
      if (!labels) {
        labels = new Int32Array(n).fill(-1);
        const open: number[] = [];
        for (let j = 0; j < n; j += 1) {
          const c = source[j];
          if (c === '\\') j += 1;
          else if (c === '[') open.push(j);
          else if (c === ']') {
            const start = open.pop();
            if (start !== undefined) labels[start] = j;
          } else if (c === '\n' && source[j + 1] === '\n') open.length = 0;
        }
      }
      return labels[at] ?? -1;
    },
  };
}

/** Parses inline Markdown; `depth` caps nested emphasis and links. */
export function parseInline(source: string, depth: number, inLink = false): MdInline[] {
  const out: MdInline[] = [];
  const scan = inlineScan(source);
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';

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
    }

    if (ch === '\n') {
      // Count trailing spaces by hand: an unanchored `/ {2,}$/` rescans the
      // whole buffer from every space (quadratic in a long run of spaces).
      let spaces = 0;
      while (buffer.charCodeAt(buffer.length - 1 - spaces) === 32) spaces += 1;
      if (spaces >= 2) {
        buffer = buffer.slice(0, buffer.length - spaces);
        flush();
        out.push({ type: 'break' });
      } else {
        buffer += '\n';
      }
      i += 1;
      continue;
    }

    if (ch === '`') {
      let length = 1;
      while (source[i + length] === '`') length += 1;
      const run = '`'.repeat(length);
      const close = source.indexOf(run, i + length);
      if (close !== -1) {
        flush();
        const code = source.slice(i + length, close).replace(/\n/g, ' ');
        out.push({
          type: 'code',
          text: code.length > 2 && code[0] === ' ' && code.endsWith(' ') ? code.slice(1, -1) : code,
        });
        i = close + length;
        continue;
      }
      buffer += run;
      i += length;
      continue;
    }

    if (depth < MARKDOWN_LIMITS.inlineDepth) {
      const emphasis = matchEmphasis(source, i, scan);
      if (emphasis) {
        flush();
        out.push({
          type: emphasis.type,
          children: parseInline(
            source.slice(emphasis.innerStart, emphasis.innerEnd),
            depth + 1,
            inLink
          ),
        });
        i = emphasis.end;
        continue;
      }

      if (ch === '!' && source[i + 1] === '[') {
        const image = matchLink(source, i + 1, scan);
        if (image) {
          // Images are not loaded from text blocks: keep the alt text only.
          buffer += source.slice(image.labelStart, image.labelEnd);
          i = image.end;
          continue;
        }
      }

      if (ch === '[' && !inLink) {
        const link = matchLink(source, i, scan);
        if (link) {
          flush();
          out.push({
            type: 'link',
            href: safeHref(link.href),
            children: parseInline(source.slice(link.labelStart, link.labelEnd), depth + 1, true),
          });
          i = link.end;
          continue;
        }
      }

      if (ch === '<' && !inLink) {
        AUTOLINK.lastIndex = i;
        const auto = AUTOLINK.exec(source);
        if (auto?.[1]) {
          flush();
          out.push({
            type: 'link',
            href: safeHref(auto[1]),
            children: [{ type: 'text', text: auto[1] }],
          });
          i += auto[0].length;
          continue;
        }
      }
    }

    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

const EMPHASIS: readonly { marker: EmphasisMarker; type: 'strong' | 'em' | 'del' }[] = [
  { marker: '**', type: 'strong' },
  { marker: '__', type: 'strong' },
  { marker: '~~', type: 'del' },
  { marker: '*', type: 'em' },
  { marker: '_', type: 'em' },
];

function matchEmphasis(
  source: string,
  at: number,
  scan: InlineScan
): { type: 'strong' | 'em' | 'del'; innerStart: number; innerEnd: number; end: number } | null {
  for (const { marker, type } of EMPHASIS) {
    if (!source.startsWith(marker, at)) continue;
    const innerStart = at + marker.length;
    const first = source[innerStart] ?? '';
    if (first === '' || /\s/.test(first)) continue;
    // `_` inside a word (snake_case) is literal.
    if (marker[0] === '_' && /[\p{L}\p{N}]/u.test(source[at - 1] ?? '')) continue;
    const close = scan.closer(marker, innerStart + 1);
    if (close === -1) continue;
    return { type, innerStart, innerEnd: close, end: close + marker.length };
  }
  return null;
}

function matchLink(
  source: string,
  at: number,
  scan: InlineScan
): { labelStart: number; labelEnd: number; href: string; end: number } | null {
  const labelEnd = scan.labelEnd(at);
  if (labelEnd === -1 || source[labelEnd + 1] !== '(') return null;
  const target = readLinkTarget(source, labelEnd + 1);
  if (!target) return null;
  return { labelStart: at + 1, labelEnd, href: target.href, end: target.end };
}

/** Plain text of an inline tree (for accessible names and summaries). */
export function inlineText(nodes: readonly MdInline[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'code') text += node.text;
    else if (node.type === 'break') text += '\n';
    else text += inlineText(node.children);
  }
  return text;
}

/**
 * Distinct heading levels used anywhere in the tree, ascending. Renderers map
 * them onto consecutive outline levels (`##` then `####` become h3 then h4).
 */
export function headingLevels(blocks: readonly MdBlock[]): number[] {
  const found = new Set<number>();
  const visit = (items: readonly MdBlock[]) => {
    for (const block of items) {
      if (block.type === 'heading') found.add(block.level);
      else if (block.type === 'quote') visit(block.children);
      else if (block.type === 'list') for (const item of block.items) visit(item.children);
    }
  };
  visit(blocks);
  return [...found].sort((a, b) => a - b);
}
