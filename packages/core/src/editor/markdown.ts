import { normalizeDocument, paragraph } from './document.ts';
import { markKey, normalizeInline, sortMarks } from './inline.ts';
import { type EditorLoadOptions, type EditorLoadResult, LoadBudget } from './load.ts';
import type {
  EditorBlock,
  EditorDocument,
  EditorInline,
  EditorListItem,
  EditorListKind,
  EditorMark,
} from './types.ts';

/**
 * The editor's Markdown codec (ADR-003): the same closed subset that
 * `@texuli/blocks` text blocks and the catalog's rich text parse, read into
 * and written from the editor model. Nothing here produces or keeps HTML: raw
 * tags stay literal text, every link passes `safeHref`, and images become
 * their alt text (or a media block when one stands alone in a paragraph).
 */
export const MARKDOWN_CODEC_LIMITS = Object.freeze({
  /** Longest source read; the rest is dropped with a diagnostic. */
  source: 100_000,
  /** Nested emphasis and links. */
  inlineDepth: 6,
});

export interface MarkdownReadOptions extends EditorLoadOptions {
  /** Override the source cap (a blocks `text` field holds 4,000 characters). */
  maxSource?: number;
}

// Line patterns stay linear on hostile lines: no two neighboring quantifiers
// can match the same characters, and `.` uses the `s` flag so U+2028 and
// U+2029 inside a line never make a `(.*)$` tail backtrack. The fence info
// string and the heading closing sequence are read by hand (their regex
// forms backtracked quadratically, and cubically, on runs of spaces).
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_LANG = /^[a-z][a-z0-9+-]{0,31}$/i;
const HEADING_OPEN = /^ {0,3}(#+)/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?(.*)$/s;
const BULLET = /^( {0,3})([-*+])[ \t]+(.*)$/s;
const ORDERED = /^( {0,3})(\d{1,9})[.)][ \t]+(.*)$/s;
const TASK = /^\[([ xX])\][ \t]+/;
const IMAGE_ONLY = /^!\[((?:[^\]\\\n]|\\.)*)\]\(\s*<?([^\s()<>]+)>?\s*\)$/;
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~<>|]/;
/** The characters that can start an inline construct (see `parseInline`). */
const INLINE_SPECIAL = /[\\\n`*_~![<]/g;

const isBlank = (line: string) => line.trim() === '';
const isSpace = (char: string | undefined) => char === ' ' || char === '\t';

/** A fence opening line: its marker and the optional language. */
function readFence(line: string): { marker: string; lang?: string } | null {
  const open = FENCE_OPEN.exec(line);
  if (!open) return null;
  const info = line.slice(open[0].length).trim();
  if (info !== '' && !FENCE_LANG.test(info)) return null;
  return info
    ? { marker: open[1] as string, lang: info.toLowerCase() }
    : { marker: open[1] as string };
}

/**
 * An ATX heading line: up to 6 `#` (a 7th or later reads as part of the
 * closing sequence), then text after a space or tab, with the closing
 * sequence of spaces, `#` and spaces dropped from the end.
 */
function readHeading(line: string): { level: number; text: string } | null {
  const open = HEADING_OPEN.exec(line);
  if (!open) return null;
  const hashes = open[1] as string;
  const level = Math.min(hashes.length, 6);
  const rest = line.slice(open[0].length - hashes.length + level);
  let start = 0;
  while (isSpace(rest[start])) start += 1;
  let end = rest.length;
  while (end > start && isSpace(rest[end - 1])) end -= 1;
  while (end > start && rest[end - 1] === '#') end -= 1;
  while (end > start && isSpace(rest[end - 1])) end -= 1;
  // Without a space or tab after the opening, only a closing sequence may follow.
  if (start === 0 && end > 0) return null;
  return { level, text: rest.slice(start, end) };
}

function listMarker(line: string): { ordered: boolean; start: number; content: string } | null {
  const bullet = BULLET.exec(line);
  if (bullet) return { ordered: false, start: 1, content: bullet[3] ?? '' };
  const ordered = ORDERED.exec(line);
  if (ordered) return { ordered: true, start: Number(ordered[2]), content: ordered[3] ?? '' };
  return null;
}

const startsBlock = (line: string) =>
  readFence(line) !== null ||
  readHeading(line) !== null ||
  RULE.test(line) ||
  QUOTE.test(line) ||
  listMarker(line) !== null;

/**
 * Read Markdown (untrusted by default) into a valid document. Never throws:
 * nesting deeper than the depth cap and oversized input degrade to text,
 * refused links keep their text, headings deeper than 4 become level 4, and
 * each degradation is reported once in `diagnostics`.
 */
export function fromMarkdown(source: unknown, options: MarkdownReadOptions = {}): EditorLoadResult {
  const budget = new LoadBudget(options);
  const max = options.maxSource ?? MARKDOWN_CODEC_LIMITS.source;
  let text = (typeof source === 'string' ? source : String(source ?? '')).replace(/\r\n?/g, '\n');
  if (text.length > max) {
    budget.report('text-truncated', `Markdown after ${max} characters was dropped.`);
    text = text.slice(0, max);
  }
  const reader = new Reader(budget);
  const blocks = reader.blocks(text.split('\n'), 0);
  return {
    doc: normalizeDocument({ version: 1, blocks }, budget.newId),
    diagnostics: budget.diagnostics,
  };
}

class Reader {
  readonly budget: LoadBudget;

  constructor(budget: LoadBudget) {
    this.budget = budget;
  }

  blocks(lines: readonly string[], depth: number): EditorBlock[] {
    const out: EditorBlock[] = [];
    const push = (make: () => EditorBlock | null) => {
      if (!this.budget.block()) return;
      const block = make();
      if (block) out.push(block);
    };
    let i = 0;
    while (i < lines.length) {
      if (this.budget.blocks >= this.budget.limits.blocks) {
        this.budget.block();
        break;
      }
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
        i += 1;
        const lang = fence.lang;
        push(() => {
          const code = this.budget.text(this.budget.clean(body.join('\n'), '\n\t'));
          return lang
            ? { id: this.budget.newId(), type: 'code', lang, text: code }
            : { id: this.budget.newId(), type: 'code', text: code };
        });
        continue;
      }
      const heading = readHeading(line);
      if (heading) {
        const level = heading.level;
        if (level > 4)
          this.budget.report('heading-clamped', 'Headings deeper than level 4 became level 4.');
        push(() => ({
          id: this.budget.newId(),
          type: 'heading',
          level: Math.min(level, 4) as 1 | 2 | 3 | 4,
          content: trimEdges(this.inline(heading.text.trim())),
        }));
        i += 1;
        continue;
      }
      if (RULE.test(line)) {
        push(() => ({ id: this.budget.newId(), type: 'divider' }));
        i += 1;
        continue;
      }
      if (QUOTE.test(line)) {
        const inner: string[] = [];
        while (i < lines.length && QUOTE.test(lines[i] ?? '')) {
          inner.push(QUOTE.exec(lines[i] ?? '')?.[1] ?? '');
          i += 1;
        }
        if (depth < this.budget.limits.depth) {
          push(() => {
            const blocks = this.blocks(inner, depth + 1);
            return blocks.length ? { id: this.budget.newId(), type: 'quote', blocks } : null;
          });
        } else {
          this.budget.report(
            'depth-capped',
            'Lists and quotes nested past the depth cap became text.'
          );
          push(() => this.paragraph(inner.join('\n')));
        }
        continue;
      }
      const marker = listMarker(line);
      if (marker) {
        const parsed = this.list(lines, i, marker.ordered, marker.start, depth);
        if (parsed.block) out.push(parsed.block);
        i = parsed.next;
        continue;
      }
      const lines_: string[] = [line];
      i += 1;
      while (i < lines.length && !isBlank(lines[i] ?? '') && !startsBlock(lines[i] ?? '')) {
        lines_.push(lines[i] ?? '');
        i += 1;
      }
      push(() => {
        // An empty paragraph (a blank link label, say) cannot be written back: drop it.
        const block = this.paragraph(lines_.join('\n'));
        return block.type === 'paragraph' && block.content.length === 0 ? null : block;
      });
    }
    return out;
  }

  paragraph(source: string): EditorBlock {
    const trimmed = source.trim();
    const image = IMAGE_ONLY.exec(trimmed);
    if (image?.[2]) {
      const alt = this.budget.text(this.budget.clean(unescapeMarkdown(image[1] ?? ''), ''));
      return { id: this.budget.newId(), type: 'media', ref: image[2], alt };
    }
    return paragraph(trimEdges(this.inline(trimmed)), this.budget.newId());
  }

  list(
    lines: readonly string[],
    from: number,
    ordered: boolean,
    start: number,
    depth: number
  ): { block: EditorBlock | null; next: number } {
    const raw: { checked: boolean | null; body: string[] }[] = [];
    let i = from;
    while (i < lines.length) {
      const marker = listMarker(lines[i] ?? '');
      if (!marker || marker.ordered !== ordered) break;
      const body: string[] = [marker.content];
      i += 1;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (isBlank(next)) {
          if (/^ {2,}\S/.test(lines[i + 1] ?? '')) {
            body.push('');
            i += 1;
            continue;
          }
          break;
        }
        if (/^ {2,}\S/.test(next)) {
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
      raw.push({ checked, body });
    }
    if (!this.budget.block()) return { block: null, next: i };
    if (depth >= this.budget.limits.depth) {
      this.budget.report('depth-capped', 'Lists and quotes nested past the depth cap became text.');
      return { block: this.paragraph(raw.map((item) => item.body.join(' ')).join('\n')), next: i };
    }
    const todo = raw.some((item) => item.checked !== null);
    const kind: EditorListKind = todo ? 'todo' : ordered ? 'ordered' : 'bullet';
    const items: EditorListItem[] = [];
    for (const item of raw) {
      if (!this.budget.block()) break;
      const read = this.blocks(item.body, depth + 1);
      // An empty first block followed by others cannot be written back: the next block leads.
      while (read.length > 1 && isEmptyText(read[0] as EditorBlock)) read.shift();
      const blocks = read.length ? read : [paragraph([], this.budget.newId())];
      items.push(
        todo
          ? { id: this.budget.newId(), checked: item.checked === true, blocks }
          : { id: this.budget.newId(), blocks }
      );
    }
    const id = this.budget.newId();
    const block: EditorBlock =
      kind === 'ordered' && start !== 1
        ? { id, type: 'list', kind, start, items }
        : { id, type: 'list', kind, items };
    return { block, next: i };
  }

  inline(source: string): readonly EditorInline[] {
    const out: EditorInline[] = [];
    parseInline(source, 0, [], false, out, this.budget);
    // Canonical like the writer: marks never start or end on whitespace.
    return prepareMarks(normalizeInline(out));
  }
}

const isEmptyText = (block: EditorBlock) =>
  (block.type === 'paragraph' || block.type === 'heading') && block.content.length === 0;

const unescapeMarkdown = (text: string) => text.replace(/\\([\\`*_{}[\]()#+\-.!~<>|])/g, '$1');

/**
 * Closers and bracket pairs of one inline source, computed once so that each
 * lookup is constant time: hostile delimiter runs stay linear. The answers
 * equal a left-to-right search from each opener.
 */
class Scan {
  readonly source: string;
  private readonly closers = new Map<string, { at: number[]; first: Int32Array }>();
  private brackets: Int32Array | null = null;

  constructor(source: string) {
    this.source = source;
  }

  /** The first valid closer of `marker` at or after `from`, or -1. */
  closer(marker: string, from: number): number {
    let table = this.closers.get(marker);
    if (!table) {
      table = this.build(marker);
      this.closers.set(marker, table);
    }
    const { at, first } = table;
    let low = 0;
    let high = at.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((at[mid] as number) < from) low = mid + 1;
      else high = mid;
    }
    return low < at.length ? (first[low] as number) : -1;
  }

  private build(marker: string): { at: number[]; first: Int32Array } {
    const { source } = this;
    const at: number[] = [];
    for (let j = source.indexOf(marker); j !== -1; j = source.indexOf(marker, j + 1)) at.push(j);
    const index = new Map(at.map((position, i) => [position, i]));
    const first = new Int32Array(at.length).fill(-1);
    for (let i = at.length - 1; i >= 0; i -= 1) {
      const close = at[i] as number;
      const before = source[close - 1] ?? '';
      const after = source[close + marker.length] ?? '';
      const doubled = marker.length === 1 && after === marker;
      const midWord = marker[0] === '_' && /[\p{L}\p{N}]/u.test(after);
      if (!/\s/.test(before) && before !== '\\' && !doubled && !midWord) {
        first[i] = close;
        continue;
      }
      // The search resumes one past this candidate (two past a doubled one).
      const resume = close + (doubled ? 2 : 1);
      let next = index.get(resume);
      if (next === undefined) {
        next = i + 1;
        while (next < at.length && (at[next] as number) < resume) next += 1;
      }
      first[i] = next < at.length ? (first[next] as number) : -1;
    }
    return { at, first };
  }

  /** The `]` closing the `[` at `open` (nesting and escapes respected), or -1. */
  bracket(open: number): number {
    if (!this.brackets) {
      const { source } = this;
      const pairs = new Int32Array(source.length).fill(-1);
      const stack: number[] = [];
      for (let j = 0; j < source.length; j += 1) {
        const c = source[j];
        if (c === '\\') j += 1;
        else if (c === '[') stack.push(j);
        else if (c === ']' && stack.length) pairs[stack.pop() as number] = j;
      }
      this.brackets = pairs;
    }
    return this.brackets[open] ?? -1;
  }
}

/** Inline Markdown into runs; `marks` are the marks open around `source`. */
function parseInline(
  source: string,
  depth: number,
  marks: readonly EditorMark[],
  inLink: boolean,
  out: EditorInline[],
  budget: LoadBudget
): void {
  let buffer = '';
  // Spaces at the end of `buffer`, kept as it grows: reading the buffer's
  // last characters would flatten the string being built on every soft line
  // break (quadratic in a long paragraph).
  let spaces = 0;
  const append = (text: string) => {
    buffer += text;
    let end = text.length;
    while (end > 0 && text.charCodeAt(end - 1) === 32) end -= 1;
    spaces = end === 0 ? spaces + text.length : text.length - end;
  };
  const flush = () => {
    if (buffer) out.push(...budget.inline(buffer.replace(/\n/g, ' '), marks));
    buffer = '';
    spaces = 0;
  };
  const push = (text: string, extra: readonly EditorMark[]) => {
    flush();
    out.push(...budget.inline(text, sortMarks([...marks, ...extra])));
  };
  const scan = new Scan(source);
  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';
    if (ch === '\\') {
      const next = source[i + 1] ?? '';
      if (next === '\n') {
        flush();
        out.push({ type: 'break' });
        budget.chars += 1;
        i += 2;
        continue;
      }
      if (ESCAPABLE.test(next)) {
        append(next);
        i += 2;
        continue;
      }
    }
    if (ch === '\n') {
      // Two or more trailing spaces make a hard break.
      if (spaces >= 2) {
        buffer = buffer.slice(0, buffer.length - spaces);
        flush();
        out.push({ type: 'break' });
        budget.chars += 1;
      } else append('\n');
      i += 1;
      continue;
    }
    if (ch === '`') {
      const run = /^`+/.exec(source.slice(i, i + 64))?.[0] ?? '`';
      const close = source.indexOf(run, i + run.length);
      if (close !== -1) {
        const code = source.slice(i + run.length, close).replace(/\n/g, ' ');
        push(code.length > 2 && /^ .* $/.test(code) ? code.slice(1, -1) : code, [{ type: 'code' }]);
        i = close + run.length;
        continue;
      }
      append(run);
      i += run.length;
      continue;
    }
    if (depth < MARKDOWN_CODEC_LIMITS.inlineDepth) {
      const emphasis = matchEmphasis(scan, i);
      if (emphasis) {
        flush();
        const mark: EditorMark = { type: emphasis.type };
        parseInline(
          source.slice(emphasis.innerStart, emphasis.innerEnd),
          depth + 1,
          sortMarks([...marks, mark]),
          inLink,
          out,
          budget
        );
        i = emphasis.end;
        continue;
      }
      if (ch === '!' && source[i + 1] === '[') {
        const image = matchLink(scan, i + 1);
        if (image) {
          append(unescapeMarkdown(source.slice(image.labelStart, image.labelEnd)));
          i = image.end;
          continue;
        }
      }
      if (ch === '[' && !inLink) {
        const link = matchLink(scan, i);
        if (link) {
          flush();
          const href = budget.href(link.href);
          const inner = href ? sortMarks([...marks, { type: 'link', href }]) : marks;
          parseInline(
            source.slice(link.labelStart, link.labelEnd),
            depth + 1,
            inner,
            true,
            out,
            budget
          );
          i = link.end;
          continue;
        }
      }
      if (ch === '<' && !inLink) {
        const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(source.slice(i, i + 2_100));
        if (auto?.[1]) {
          const href = budget.href(auto[1]);
          push(auto[1], href ? [{ type: 'link', href }] : []);
          i += auto[0].length;
          continue;
        }
      }
    }
    // Plain text up to the next character that can open a construct is
    // copied in one slice, not one character at a time.
    INLINE_SPECIAL.lastIndex = i + 1;
    const stop = INLINE_SPECIAL.test(source) ? INLINE_SPECIAL.lastIndex - 1 : source.length;
    append(source.slice(i, stop));
    i = stop;
  }
  flush();
}

function matchEmphasis(
  scan: Scan,
  at: number
): { type: 'strong' | 'em' | 'strike'; innerStart: number; innerEnd: number; end: number } | null {
  const { source } = scan;
  const candidates = [
    { marker: '**', type: 'strong' },
    { marker: '__', type: 'strong' },
    { marker: '~~', type: 'strike' },
    { marker: '*', type: 'em' },
    { marker: '_', type: 'em' },
  ] as const;
  for (const { marker, type } of candidates) {
    if (!source.startsWith(marker, at)) continue;
    const innerStart = at + marker.length;
    const first = source[innerStart] ?? '';
    if (first === '' || /\s/.test(first)) continue;
    if (marker[0] === '_' && /[\p{L}\p{N}]/u.test(source[at - 1] ?? '')) continue;
    const close = scan.closer(marker, innerStart + 1);
    if (close === -1) continue;
    return { type, innerStart, innerEnd: close, end: close + marker.length };
  }
  return null;
}

function matchLink(
  scan: Scan,
  at: number
): { labelStart: number; labelEnd: number; href: string; end: number } | null {
  const { source } = scan;
  const labelEnd = scan.bracket(at);
  if (labelEnd === -1 || source[labelEnd + 1] !== '(') return null;
  // A target is read from at most 2,100 characters after the label.
  const target = readLinkTarget(source.slice(labelEnd + 1, labelEnd + 1 + 2_100), 0);
  if (!target) return null;
  return { labelStart: at + 1, labelEnd, href: target.href, end: labelEnd + 1 + target.end };
}

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

// ---------------------------------------------------------------------------
// Writing

const escapeText = (text: string) => text.replace(/[\\`*_[\]~<!]/g, '\\$&');

/** A line that would start another block gets its first marker escaped. */
function escapeLineStart(line: string): string {
  const ordered = /^( {0,3}\d{1,9})([.)])([ \t]|$)/.exec(line);
  if (ordered)
    return `${ordered[1]}\\${ordered[2]}${line.slice((ordered[1] as string).length + 1)}`;
  if (startsBlock(line)) {
    return line.replace(/^( {0,3})(\S)/, '$1\\$2');
  }
  return line;
}

const encodeRef = (href: string) =>
  href.replace(
    /[\s()<>]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
  );

function codeSpan(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') || /^ .* $/.test(text) ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

type Run = { text: string; marks: readonly EditorMark[] } | null;

/**
 * Move whitespace and trailing backslashes out of strong, em and strike spans
 * (Markdown cannot open or close there). Works on runs, splitting a run only
 * where a span edge moves: one pass per mark type, no object per character.
 */
function prepareMarks(content: readonly EditorInline[]): EditorInline[] {
  let runs: Run[] = content.flatMap((node) =>
    node.type === 'break' ? [null] : node.text ? [{ text: node.text, marks: node.marks }] : []
  );
  for (const type of ['strong', 'em', 'strike'] as const) {
    const marked = (run: Run | undefined) => run?.marks.some((m) => m.type === type) === true;
    const strip = (run: NonNullable<Run>, text: string) => ({
      text,
      marks: run.marks.filter((m) => m.type !== type),
    });
    const out: Run[] = [];
    let i = 0;
    while (i < runs.length) {
      if (!marked(runs[i])) {
        out.push(runs[i] as Run);
        i += 1;
        continue;
      }
      // A span: marked text, and breaks with marked text on both sides.
      let end = i;
      for (let k = i + 1; k < runs.length; k += 1) {
        if (runs[k] === null) continue;
        if (!marked(runs[k])) break;
        end = k;
      }
      const span = runs.slice(i, end + 1);
      // Leading whitespace leaves the span, up to the first other character
      // or break; then trailing whitespace and backslashes, from the end.
      const head: Run[] = [];
      const tail: Run[] = [];
      let a = 0;
      let b = span.length - 1;
      for (; a <= b; a += 1) {
        const run = span[a] as Run;
        if (!run) break;
        let cut = 0;
        while (/\s/.test(run.text[cut] ?? '')) cut += 1;
        if (cut) head.push(strip(run, run.text.slice(0, cut)));
        if (cut < run.text.length) {
          span[a] = { text: run.text.slice(cut), marks: run.marks };
          break;
        }
      }
      for (; b >= a; b -= 1) {
        const run = span[b] as Run;
        if (!run) break;
        let cut = run.text.length;
        while (/[\s\\]/.test(run.text[cut - 1] ?? '')) cut -= 1;
        if (cut < run.text.length) tail.push(strip(run, run.text.slice(cut)));
        if (cut) {
          span[b] = { text: run.text.slice(0, cut), marks: run.marks };
          break;
        }
      }
      // One push per run: a spread of a long span could overflow the call stack.
      for (const run of [...head, ...span.slice(a, b + 1), ...tail.reverse()]) out.push(run);
      i = end + 1;
    }
    runs = out;
  }
  return normalizeInline(
    runs.map((run) => (run ? { type: 'text', ...run } : { type: 'break' }))
  ) as EditorInline[];
}

function writeInline(content: readonly EditorInline[], em: '*' | '_'): string {
  const open: Record<string, string> = { strong: '**', em, strike: '~~' };
  const texts = content.flatMap((node) => (node.type === 'text' ? [{ node }] : []));
  const stack: EditorMark[] = [];
  const outer = (marks: readonly EditorMark[]) => marks.filter((m) => m.type !== 'code');
  // Where the span of each mark starting at text `t` ends (marks that end
  // later nest outside), computed once from the end so long spans stay linear.
  const ends: Map<string, number>[] = new Array(texts.length);
  for (let t = texts.length - 1; t >= 0; t -= 1) {
    const here = new Map<string, number>();
    for (const mark of (texts[t] as (typeof texts)[number]).node.marks) {
      const key = markKey(mark);
      here.set(key, ends[t + 1]?.get(key) ?? t);
    }
    ends[t] = here;
  }
  const spanEnd = (t: number, mark: EditorMark): number => ends[t]?.get(markKey(mark)) ?? t;
  const ordered = (t: number): EditorMark[] => {
    const marks = outer((texts[t] as { node: Extract<EditorInline, { type: 'text' }> }).node.marks);
    const opened = (mark: EditorMark) => {
      const at = stack.findIndex((open) => markKey(open) === markKey(mark));
      return at === -1 ? Number.POSITIVE_INFINITY : at;
    };
    // Later-ending marks nest outside; on a tie, a mark already open stays outside.
    return marks
      .map((mark, rank) => ({ mark, rank, end: spanEnd(t, mark), open: opened(mark) }))
      .sort((a, b) => b.end - a.end || a.open - b.open || a.rank - b.rank)
      .map(({ mark }) => mark);
  };
  let out = '';
  const close = (to: number) => {
    while (stack.length > to) {
      const mark = stack.pop() as EditorMark;
      out += mark.type === 'link' ? `](${encodeRef(mark.href)})` : open[mark.type];
    }
  };
  const keepCommon = (wanted: readonly EditorMark[]) => {
    let common = 0;
    while (
      common < stack.length &&
      common < wanted.length &&
      markKey(stack[common] as EditorMark) === markKey(wanted[common] as EditorMark)
    )
      common += 1;
    close(common);
    return common;
  };
  let t = 0;
  content.forEach((node) => {
    if (node.type === 'break') {
      // Marks the next text keeps stay open across the break.
      // `t` texts are written, so the next one is `texts[t]`.
      const next = t < texts.length ? t : -1;
      keepCommon(
        next === -1 ? [] : ordered(next).filter((m) => stack.some((s) => markKey(s) === markKey(m)))
      );
      out += '\\\n';
      return;
    }
    const wanted = ordered(t);
    const common = keepCommon(wanted);
    for (const mark of wanted.slice(common)) {
      out += mark.type === 'link' ? '[' : open[mark.type];
      stack.push(mark);
    }
    out += node.marks.some((m) => m.type === 'code') ? codeSpan(node.text) : escapeText(node.text);
    t += 1;
  });
  close(0);
  return out;
}

const sameInline = (a: readonly EditorInline[], b: readonly EditorInline[]) =>
  a.length === b.length &&
  a.every((node, i) => {
    const other = b[i] as EditorInline;
    if (node.type === 'break' || other.type === 'break') return node.type === other.type;
    return (
      node.text === other.text && node.marks.map(markKey).join() === other.marks.map(markKey).join()
    );
  });

/** Read inline Markdown back without caps or policy changes (for the write check). */
function reread(markdown: string): readonly EditorInline[] {
  const budget = new LoadBudget({ trust: 'developer' });
  const out: EditorInline[] = [];
  parseInline(markdown, 0, [], false, out, budget);
  return normalizeInline(out);
}

/**
 * Inline content as Markdown that reads back to the same runs. When a mark
 * combination has no faithful spelling in the subset, the result drops the
 * least significant marks (em, then strike, then strong) until it does.
 */
function inlineMarkdown(
  content: readonly EditorInline[],
  lineStart: (line: string) => string
): string {
  let prepared = prepareMarks(content);
  const attempt = (em: '*' | '_') => {
    const text = writeInline(prepared, em).split('\n').map(lineStart).join('\n');
    return sameInline(reread(text), prepared) ? text : null;
  };
  for (const drop of [null, 'em', 'strike', 'strong'] as const) {
    if (drop)
      prepared = normalizeInline(
        prepared.map((n) =>
          n.type === 'text' ? { ...n, marks: n.marks.filter((m) => m.type !== drop) } : n
        )
      ) as EditorInline[];
    const text = attempt('*') ?? attempt('_');
    if (text !== null) return text;
  }
  return writeInline(prepared, '*').split('\n').map(lineStart).join('\n');
}

const indent = (text: string, by: string) =>
  text
    .split('\n')
    .map((line) => (line ? by + line : line))
    .join('\n');

function writeBlocks(blocks: readonly EditorBlock[]): string {
  return blocks
    .map(writeBlock)
    .filter((text) => text !== '')
    .join('\n\n');
}

function writeBlock(block: EditorBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlineMarkdown(trimEdges(block.content), escapeLineStart);
    case 'heading': {
      const flat = block.content.map(
        (n): EditorInline => (n.type === 'break' ? { type: 'text', text: ' ', marks: [] } : n)
      );
      const text = inlineMarkdown(trimEdges(normalizeInline(flat)), (line) => line);
      return `${'#'.repeat(block.level)}${text ? ` ${text}` : ''}${text.endsWith('#') ? ' #' : ''}`;
    }
    case 'code': {
      const longest = Math.max(
        2,
        ...[...block.text.matchAll(/^[ \t]*(`+)/gm)].map((m) => (m[1] as string).length)
      );
      const fence = '`'.repeat(longest + 1);
      return `${fence}${block.lang ?? ''}\n${block.text}${block.text ? '\n' : ''}${fence}`;
    }
    case 'list':
      return block.items
        .map((item, i) => {
          const marker =
            block.kind === 'ordered'
              ? `${(block.start ?? 1) + i}. `
              : block.kind === 'todo'
                ? `- [${item.checked ? 'x' : ' '}] `
                : '- ';
          const [first, ...rest] = item.blocks;
          const head = first ? indent(writeBlock(first), '    ').trimStart() : '';
          const tail = writeBlocks(rest);
          return `${marker}${head}${tail ? `\n\n${indent(tail, '    ')}` : ''}`;
        })
        .join('\n');
    case 'quote':
      return writeBlocks(block.blocks)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'divider':
      return '---';
    case 'media':
      return `![${escapeText(block.alt)}](${encodeRef(block.ref)})`;
  }
}

/** Paragraph edges are trimmed when read, so they are trimmed when written. */
function trimEdges(content: readonly EditorInline[]): readonly EditorInline[] {
  const out = [...content];
  while (out[0]?.type === 'break') out.shift();
  while (out.at(-1)?.type === 'break') out.pop();
  const plain = (node: EditorInline | undefined): node is Extract<EditorInline, { type: 'text' }> =>
    node?.type === 'text' && !node.marks.some((mark) => mark.type === 'code');
  const first = out[0];
  if (plain(first)) out[0] = { ...first, text: first.text.trimStart() };
  const last = out.at(-1);
  if (plain(last)) out[out.length - 1] = { ...last, text: last.text.trimEnd() };
  return normalizeInline(out);
}

/**
 * Write a document as the closed Markdown subset. Reading the result back
 * gives the same document, except for what the subset cannot spell: empty
 * paragraphs, breaks in headings (written as spaces), breaks at the edges of
 * a block, and whitespace at the edges of a paragraph or a mark.
 */
export function toMarkdown(doc: EditorDocument): string {
  return writeBlocks(doc.blocks);
}
