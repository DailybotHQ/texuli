import {
  type MdBlock,
  type MdInline,
  parseInlineMarkdown,
  parseMarkdown,
} from '../markdown/index.ts';
import { normalizeDocument, paragraph } from './document.ts';
import {
  acceptsExtensionId,
  EDITOR_EXTENSION_LIMITS,
  EDITOR_EXTENSION_SIGILS,
  type EditorInlineExtension,
  type EditorInlineExtensions,
  isExtensionIdChar,
  toInlineExtensions,
} from './extensions.ts';
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

export interface MarkdownWriteOptions {
  /**
   * Host inline extensions written as `<sigil>{id|label}`. Extension marks of
   * other names are written as their label text, and plain text that would
   * read as a token gets its `{` escaped.
   */
  extensions?: EditorInlineExtensions | readonly EditorInlineExtension[];
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

/** The GFM the editor reads: task items and strikethrough (tables, footnotes and bare autolinks are not in the subset). */
const EDITOR_GFM = {
  table: false,
  footnote: false,
  autolink: false,
  strikethrough: true,
  taskList: true,
} as const;

// An escaped `{`, `}` or extension sigil must not open or close an extension token: before the
// shared parser reads the source, each becomes a private-use placeholder (U+E000 onwards),
// restored afterwards (as the character in text, as the escape in code and raw HTML). A
// placeholder character already in the source becomes U+FFFD.
const SHIELDED = ['{', '}', ...EDITOR_EXTENSION_SIGILS] as const;
const PLACEHOLDER_BASE = 0xe000;
const PLACEHOLDERS = new RegExp(
  `[\\uE000-\\u${(PLACEHOLDER_BASE + SHIELDED.length - 1).toString(16)}]`,
  'g'
);
const placeholderOf = new Map<string, string>(
  SHIELDED.map((char, index) => [char, String.fromCharCode(PLACEHOLDER_BASE + index)])
);

function shield(source: string): string {
  PLACEHOLDERS.lastIndex = 0;
  if (!source.includes('\\') && !PLACEHOLDERS.test(source)) return source;
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i] as string;
    const code = c.charCodeAt(0);
    if (code >= PLACEHOLDER_BASE && code < PLACEHOLDER_BASE + SHIELDED.length) out += '\uFFFD';
    else if (c === '\\' && i + 1 < source.length) {
      const next = source[i + 1] as string;
      out += placeholderOf.get(next) ?? c + next;
      i += 1;
    } else out += c;
  }
  return out;
}

const restore = (text: string, escaped: boolean) =>
  text.replace(PLACEHOLDERS, (char) => {
    const original = SHIELDED[char.charCodeAt(0) - PLACEHOLDER_BASE] as string;
    return escaped ? `\\${original}` : original;
  });
/** Placeholders back to their characters (text, URLs, alt text). */
const unshield = (text: string) => restore(text, false);
/** Placeholders back to the escapes as written (code and raw HTML keep backslashes). */
const unshieldRaw = (text: string) => restore(text, true);

/**
 * Read Markdown (untrusted by default) into a valid document. Never throws:
 * nesting deeper than the depth cap and oversized input degrade to text,
 * refused links keep their text, headings deeper than 4 become level 4, and
 * each degradation is reported once in `diagnostics`.
 *
 * The source is read by the shared CommonMark parser (`@texuli/core/markdown`,
 * ADR-034; GFM task items and strikethrough) and filtered down to the editor
 * vocabulary: setext headings read as headings and indented code as code, raw
 * HTML stays literal text, link reference definitions resolve their links and
 * are not kept, and an image alone in a paragraph becomes a media block.
 */
export function fromMarkdown(source: unknown, options: MarkdownReadOptions = {}): EditorLoadResult {
  const budget = new LoadBudget(options);
  const max = options.maxSource ?? MARKDOWN_CODEC_LIMITS.source;
  let text = (typeof source === 'string' ? source : String(source ?? '')).replace(/\r\n?/g, '\n');
  if (text.length > max) {
    budget.report('text-truncated', `Markdown after ${max} characters was dropped.`);
    text = text.slice(0, max);
  }
  const parsed = parseMarkdown(shield(text), {
    gfm: EDITOR_GFM,
    limits: { blockDepth: budget.limits.depth, inlineDepth: MARKDOWN_CODEC_LIMITS.inlineDepth },
  });
  const blocks = new Projector(budget).blocks(parsed.tree.children);
  if (parsed.diagnostics.some((diagnostic) => diagnostic.code === 'depth-limit'))
    budget.report('depth-capped', 'Lists and quotes nested past the depth cap became text.');
  return {
    doc: normalizeDocument({ version: 1, blocks }, budget.newId),
    diagnostics: budget.diagnostics,
  };
}

/** The shared tree filtered down to editor blocks and runs. */
class Projector {
  readonly budget: LoadBudget;

  constructor(budget: LoadBudget) {
    this.budget = budget;
  }

  blocks(nodes: readonly MdBlock[]): EditorBlock[] {
    const out: EditorBlock[] = [];
    for (const node of nodes) {
      if (this.budget.blocks >= this.budget.limits.blocks) {
        this.budget.block();
        break;
      }
      if (node.type === 'list') {
        const list = this.list(node);
        if (list) out.push(list);
        continue;
      }
      if (node.type === 'definition') continue;
      if (!this.budget.block()) continue;
      const block = this.block(node);
      if (block) out.push(block);
    }
    return out;
  }

  private block(node: MdBlock): EditorBlock | null {
    const { budget } = this;
    switch (node.type) {
      case 'paragraph': {
        const only = node.children[0];
        if (node.children.length === 1 && only?.type === 'image' && !only.title && only.url) {
          const alt = budget.text(budget.clean(unshield(only.alt), ''));
          return { id: budget.newId(), type: 'media', ref: unshield(only.url), alt };
        }
        // An empty paragraph (a blank link label, say) cannot be written back: drop it.
        const content = trimEdges(this.inline(node.children));
        return content.length === 0 ? null : paragraph(content, budget.newId());
      }
      case 'heading':
        if (node.depth > 4)
          budget.report('heading-clamped', 'Headings deeper than level 4 became level 4.');
        return {
          id: budget.newId(),
          type: 'heading',
          level: Math.min(node.depth, 4) as 1 | 2 | 3 | 4,
          content: trimEdges(this.inline(node.children)),
        };
      case 'thematicBreak':
        return { id: budget.newId(), type: 'divider' };
      case 'code': {
        const text = budget.text(budget.clean(unshieldRaw(node.value), '\n\t'));
        const lang =
          node.lang && !node.meta && FENCE_LANG.test(node.lang)
            ? node.lang.toLowerCase()
            : undefined;
        return lang
          ? { id: budget.newId(), type: 'code', lang, text }
          : { id: budget.newId(), type: 'code', text };
      }
      case 'blockquote': {
        const blocks = this.blocks(node.children);
        return blocks.length ? { id: budget.newId(), type: 'quote', blocks } : null;
      }
      case 'html': {
        // Raw HTML is never markup: the block reads as a paragraph whose tags stay literal text.
        const { children } = parseInlineMarkdown(node.value, { gfm: EDITOR_GFM });
        const content = trimEdges(this.inline(children));
        return content.length === 0 ? null : paragraph(content, budget.newId());
      }
      default:
        return null;
    }
  }

  private list(node: Extract<MdBlock, { type: 'list' }>): EditorBlock | null {
    const { budget } = this;
    if (!budget.block()) return null;
    const todo = node.children.some((item) => item.checked !== undefined);
    const kind: EditorListKind = todo ? 'todo' : node.ordered ? 'ordered' : 'bullet';
    const items: EditorListItem[] = [];
    for (const item of node.children) {
      if (!budget.block()) break;
      const read = this.blocks(item.children);
      // An empty first block followed by others cannot be written back: the next block leads.
      while (read.length > 1 && isEmptyText(read[0] as EditorBlock)) read.shift();
      const blocks = read.length ? read : [paragraph([], budget.newId())];
      items.push(
        todo
          ? { id: budget.newId(), checked: item.checked === true, blocks }
          : { id: budget.newId(), blocks }
      );
    }
    const id = budget.newId();
    const start = node.ordered ? (node.start ?? 1) : 1;
    return kind === 'ordered' && start !== 1
      ? { id, type: 'list', kind, start, items }
      : { id, type: 'list', kind, items };
  }

  inline(nodes: readonly MdInline[]): readonly EditorInline[] {
    const out: EditorInline[] = [];
    this.walk(nodes, [], false, out);
    // Canonical like the writer: marks never start or end on whitespace.
    return prepareMarks(normalizeInline(out));
  }

  private walk(
    nodes: readonly MdInline[],
    marks: readonly EditorMark[],
    inLink: boolean,
    out: EditorInline[]
  ): void {
    const { budget } = this;
    const add = (mark: EditorMark) => sortMarks([...marks, mark]);
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          this.text(node.value, marks, inLink, out);
          break;
        case 'break':
          out.push({ type: 'break' });
          budget.chars += 1;
          break;
        case 'inlineCode':
          out.push(...budget.inline(unshieldRaw(node.value), add({ type: 'code' })));
          break;
        case 'html':
          // Raw tags stay literal text.
          out.push(...budget.inline(unshieldRaw(node.value).replace(/\n/g, ' '), marks));
          break;
        case 'image':
          // An image inside text keeps its alt text.
          out.push(...budget.inline(unshield(node.alt).replace(/\n/g, ' '), marks));
          break;
        case 'emphasis':
          this.walk(node.children, add({ type: 'em' }), inLink, out);
          break;
        case 'strong':
          this.walk(node.children, add({ type: 'strong' }), inLink, out);
          break;
        case 'delete':
          this.walk(node.children, add({ type: 'strike' }), inLink, out);
          break;
        case 'link': {
          const url = unshield(node.url);
          const href = budget.href(url);
          const only = node.children[0];
          // A refused autolink (`<scheme:…>`) stays literal text, angle brackets included.
          if (
            !href &&
            node.children.length === 1 &&
            only?.type === 'text' &&
            (only.value === node.url || `mailto:${only.value}` === node.url)
          ) {
            out.push(...budget.inline(`<${unshield(only.value)}>`, marks));
            break;
          }
          this.walk(node.children, href ? add({ type: 'link', href }) : marks, true, out);
          break;
        }
        default:
          if ('children' in node) this.walk(node.children as MdInline[], marks, inLink, out);
      }
    }
  }

  /** Plain text, with host extension tokens `<sigil>{id|label}` read outside links. */
  private text(
    value: string,
    marks: readonly EditorMark[],
    inLink: boolean,
    out: EditorInline[]
  ): void {
    const { budget } = this;
    const plain = (text: string) => {
      // A soft line break reads as a space.
      if (text) out.push(...budget.inline(unshield(text).replace(/\n/g, ' '), marks));
    };
    const extensions = budget.extensions;
    if (inLink || extensions.bySigil.size === 0) {
      plain(value);
      return;
    }
    // The next `}` before a line break, from each index (one pass, then constant time).
    let close: Int32Array | null = null;
    let cursor = 0;
    for (let i = 0; i < value.length; i += 1) {
      const extension = extensions.bySigil.get(value[i] as string);
      if (!extension || value[i + 1] !== '{') continue;
      let idEnd = i + 2;
      while (
        idEnd < value.length &&
        idEnd - (i + 2) <= EDITOR_EXTENSION_LIMITS.id &&
        isExtensionIdChar(value.charCodeAt(idEnd))
      )
        idEnd += 1;
      if (value[idEnd] !== '|') continue;
      const id = value.slice(i + 2, idEnd);
      if (!close) {
        close = new Int32Array(value.length + 1).fill(-1);
        for (let j = value.length - 1; j >= 0; j -= 1)
          close[j] = value[j] === '\n' ? -1 : value[j] === '}' ? j : (close[j + 1] as number);
      }
      const labelStart = idEnd + 1;
      const labelEnd = close[labelStart] ?? -1;
      if (labelEnd <= labelStart || labelEnd - labelStart > EDITOR_EXTENSION_LIMITS.label) continue;
      if (!acceptsExtensionId(extensions, extension.name, id)) continue;
      plain(value.slice(cursor, i));
      out.push(
        ...budget.inline(
          unshield(value.slice(labelStart, labelEnd)),
          sortMarks([...marks, { type: 'extension', name: extension.name, id }])
        )
      );
      cursor = labelEnd + 1;
      i = labelEnd;
    }
    plain(value.slice(cursor));
  }
}

const isEmptyText = (block: EditorBlock) =>
  (block.type === 'paragraph' || block.type === 'heading') && block.content.length === 0;

// ---------------------------------------------------------------------------
// Writing

// `&` before a name or `#` would read as a character reference.
const escapeText = (text: string) => text.replace(/[\\`*_[\]~<!]|&(?=[A-Za-z0-9#])/g, '\\$&');

/** Plain text: a registered sigil before `{` would read as a token, so `{` is escaped. */
const escapePlain = (text: string, extensions: EditorInlineExtensions) =>
  extensions.literal ? escapeText(text).replace(extensions.literal, '$1\\{') : escapeText(text);

/** An extension token: the label escaped so no closer or delimiter inside it counts. */
function extensionToken(
  mark: Extract<EditorMark, { type: 'extension' }>,
  label: string,
  extensions: EditorInlineExtensions
): string | null {
  const extension = extensions.byName.get(mark.name);
  if (!extension) return null;
  return `${extension.sigil}{${mark.id}|${escapeText(label).replace(/[{}]/g, '\\$&')}}`;
}

/** A line that would start another block gets its first marker escaped. */
function escapeLineStart(line: string): string {
  const ordered = /^( {0,3}\d{1,9})([.)])([ \t]|$)/.exec(line);
  if (ordered)
    return `${ordered[1]}\\${ordered[2]}${line.slice((ordered[1] as string).length + 1)}`;
  // A run of `=` or `-` alone on a line would underline a setext heading.
  if (startsBlock(line) || /^ {0,3}(?:=+|-+)[ \t]*$/.test(line)) {
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
  // CommonMark strips one space from each side when both are spaces and not every character is.
  const pad =
    text.startsWith('`') ||
    text.endsWith('`') ||
    (text.length > 1 && text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text))
      ? ' '
      : '';
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

function writeInline(
  content: readonly EditorInline[],
  em: '*' | '_',
  extensions: EditorInlineExtensions
): string {
  const open: Record<string, string> = { strong: '**', em, strike: '~~' };
  const texts = content.flatMap((node) => (node.type === 'text' ? [{ node }] : []));
  const stack: EditorMark[] = [];
  // Code spans and extension tokens are leaves: other marks nest around them.
  const outer = (marks: readonly EditorMark[]) =>
    marks.filter((m) => m.type !== 'code' && m.type !== 'extension');
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
      out += mark.type === 'link' ? `](${encodeRef(mark.href)})` : (open[mark.type] ?? '');
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
      out += mark.type === 'link' ? '[' : (open[mark.type] ?? '');
      stack.push(mark);
    }
    const entity = node.marks.find((m) => m.type === 'extension');
    const token = entity ? extensionToken(entity, node.text, extensions) : null;
    out +=
      token ??
      (node.marks.some((m) => m.type === 'code')
        ? codeSpan(node.text)
        : escapePlain(node.text, extensions));
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
function reread(markdown: string, extensions: EditorInlineExtensions): readonly EditorInline[] {
  const budget = new LoadBudget({ trust: 'developer', extensions });
  const { children } = parseInlineMarkdown(shield(markdown), { gfm: EDITOR_GFM });
  return normalizeInline([...new Projector(budget).inline(children)]);
}

/**
 * Inline content as Markdown that reads back to the same runs. When a mark
 * combination has no faithful spelling in the subset, the result drops the
 * least significant marks (em, then strike, then strong) until it does.
 */
function inlineMarkdown(
  content: readonly EditorInline[],
  lineStart: (line: string) => string,
  extensions: EditorInlineExtensions
): string {
  let prepared = prepareMarks(withRegistered(content, extensions));
  const attempt = (em: '*' | '_') => {
    const text = writeInline(prepared, em, extensions).split('\n').map(lineStart).join('\n');
    return sameInline(reread(text, extensions), prepared) ? text : null;
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
  return writeInline(prepared, '*', extensions).split('\n').map(lineStart).join('\n');
}

/** Extension marks of unregistered names leave (their label stays plain text). */
function withRegistered(
  content: readonly EditorInline[],
  extensions: EditorInlineExtensions
): readonly EditorInline[] {
  const foreign = (mark: EditorMark) =>
    mark.type === 'extension' && !extensions.byName.has(mark.name);
  if (!content.some((n) => n.type === 'text' && n.marks.some(foreign))) return content;
  return normalizeInline(
    content.map((n) =>
      n.type === 'text' && n.marks.some(foreign)
        ? { ...n, marks: n.marks.filter((m) => !foreign(m)) }
        : n
    )
  );
}

const indent = (text: string, by: string) =>
  text
    .split('\n')
    .map((line) => (line ? by + line : line))
    .join('\n');

function writeBlocks(blocks: readonly EditorBlock[], extensions: EditorInlineExtensions): string {
  // Two adjacent lists would merge into one: the second switches its marker (`*`, `)`).
  let alternate = false;
  return blocks
    .map((block, index) => {
      const previous = blocks[index - 1];
      const sameKind =
        block.type === 'list' &&
        previous?.type === 'list' &&
        (previous.kind === 'ordered') === (block.kind === 'ordered');
      alternate = sameKind ? !alternate : false;
      return writeBlock(block, extensions, alternate);
    })
    .filter((text) => text !== '')
    .join('\n\n');
}

function writeBlock(
  block: EditorBlock,
  extensions: EditorInlineExtensions,
  alternate = false
): string {
  switch (block.type) {
    case 'paragraph':
      return inlineMarkdown(trimEdges(block.content), escapeLineStart, extensions);
    case 'heading': {
      const flat = block.content.map(
        (n): EditorInline => (n.type === 'break' ? { type: 'text', text: ' ', marks: [] } : n)
      );
      const text = inlineMarkdown(trimEdges(normalizeInline(flat)), (line) => line, extensions);
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
          const bullet = alternate ? '*' : '-';
          const marker =
            block.kind === 'ordered'
              ? `${(block.start ?? 1) + i}${alternate ? ')' : '.'} `
              : block.kind === 'todo'
                ? `${bullet} [${item.checked ? 'x' : ' '}] `
                : `${bullet} `;
          const [first, ...rest] = item.blocks;
          const head = first ? indent(writeBlock(first, extensions), '    ').trimStart() : '';
          const tail = writeBlocks(rest, extensions);
          // An empty first line followed by a blank line would end the item (CommonMark): the
          // rest then starts on the next line.
          if (!head && tail) return `${marker.trimEnd()}\n${indent(tail, '    ')}`;
          return `${marker}${head}${tail ? `\n\n${indent(tail, '    ')}` : ''}`;
        })
        .join('\n');
    case 'quote':
      return writeBlocks(block.blocks, extensions)
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
    node?.type === 'text' &&
    !node.marks.some((mark) => mark.type === 'code' || mark.type === 'extension');
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
export function toMarkdown(doc: EditorDocument, options: MarkdownWriteOptions = {}): string {
  return writeBlocks(doc.blocks, toInlineExtensions(options.extensions));
}
