import { parseInlineMarkdown, parseMarkdown } from '../markdown/index.ts';
import { normalizeDocument } from './document.ts';
import {
  type EditorInlineExtension,
  type EditorInlineExtensions,
  toInlineExtensions,
} from './extensions.ts';
import { markKey, normalizeInline } from './inline.ts';
import { type EditorLoadOptions, type EditorLoadResult, LoadBudget } from './load.ts';
import {
  FENCE_LANG,
  Projector,
  prepareMarks,
  type RawHtmlReader,
  shield,
  trimEdges,
} from './project.ts';

export { fromMarkdownTree, type MarkdownTreeReadOptions } from './project.ts';

import type { EditorBlock, EditorDocument, EditorInline, EditorMark } from './types.ts';

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
  const blocks = new Projector(budget, readRawHtml).blocks(parsed.tree.children);
  if (parsed.diagnostics.some((diagnostic) => diagnostic.code === 'depth-limit'))
    budget.report('depth-capped', 'Lists and quotes nested past the depth cap became text.');
  return {
    doc: normalizeDocument({ version: 1, blocks }, budget.newId),
    diagnostics: budget.diagnostics,
  };
}

/** The shared tree filtered down to editor blocks and runs. */
/** The Markdown reader's rule: a raw HTML block reads as inline Markdown. */
const readRawHtml: RawHtmlReader = (source) =>
  parseInlineMarkdown(source, { gfm: EDITOR_GFM }).children;

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
  return normalizeInline([...new Projector(budget, readRawHtml).inline(children)]);
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

export function toMarkdown(doc: EditorDocument, options: MarkdownWriteOptions = {}): string {
  return writeBlocks(doc.blocks, toInlineExtensions(options.extensions));
}
