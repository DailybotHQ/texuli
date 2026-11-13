/**
 * The editor's Markdown projection (ADR-034): a `texuli-md/v1` tree onto the closed editor
 * vocabulary. Split from `markdown.ts` so that a projection of a tree read elsewhere
 * (`fromMarkdownTree`, the HTML paste path) bundles without the CommonMark parser: nothing here
 * imports it. `markdown.ts` reads Markdown source with the parser and projects through this.
 */
import type { MdBlock, MdInline, MdRoot } from '../markdown/ast.ts';
import { normalizeDocument, paragraph } from './document.ts';
import {
  acceptsExtensionId,
  EDITOR_EXTENSION_LIMITS,
  EDITOR_EXTENSION_SIGILS,
  isExtensionIdChar,
} from './extensions.ts';
import { normalizeInline, sortMarks } from './inline.ts';
import { type EditorLoadOptions, type EditorLoadResult, LoadBudget } from './load.ts';
import type {
  EditorBlock,
  EditorInline,
  EditorListItem,
  EditorListKind,
  EditorMark,
} from './types.ts';

export const FENCE_LANG = /^[a-z][a-z0-9+-]{0,31}$/i;

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

export function shield(source: string): string {
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
export const unshield = (text: string) => restore(text, false);
/** Placeholders back to the escapes as written (code and raw HTML keep backslashes). */
export const unshieldRaw = (text: string) => restore(text, true);

export interface MarkdownTreeReadOptions extends EditorLoadOptions {
  /**
   * An image alone in a paragraph: a `media` block (`'media'`, the Markdown reader's rule) or
   * its alt text (`'text'`, the paste rule: pasted media becomes a block only through the
   * host's `resolveMedia`). Default `'media'`.
   */
  images?: 'media' | 'text';
}

const PLACEHOLDER_IN_TEXT = /[\uE000-\uE0FF]/g;

/**
 * A tree from another reader (`htmlToMarkdownTree` from `@texuli/core/html`, say) prepared for
 * the projector: placeholder characters become U+FFFD (the source was not shielded), images
 * become their alt text when asked, table cells become paragraphs, footnote content and
 * mentions keep their text, and lists and quotes nested past `depth` are unwrapped into their
 * parent. Iterative per level and bounded by the reader's own limits.
 */
function prepareTree(
  nodes: readonly MdBlock[],
  depth: number,
  images: 'media' | 'text',
  capped: { hit: boolean }
): MdBlock[] {
  const out: MdBlock[] = [];
  const inline = (list: readonly MdInline[]): MdInline[] =>
    list.map((node): MdInline => {
      if (node.type === 'text')
        return { ...node, value: node.value.replace(PLACEHOLDER_IN_TEXT, '\uFFFD') };
      if (node.type === 'image' && images === 'text')
        return { type: 'text', value: node.alt.replace(PLACEHOLDER_IN_TEXT, '\uFFFD') };
      // The editor has no mention node: keep what the reader showed.
      if (node.type === 'mention')
        return {
          type: 'text',
          value:
            node.kind === 'everyone' || node.kind === 'here'
              ? `@${node.kind}`
              : `${node.kind === 'channel' ? '#' : '@'}${node.label ?? node.id ?? ''}`,
        };
      if ('children' in node)
        return { ...node, children: inline(node.children as MdInline[]) } as MdInline;
      return node;
    });
  for (const node of nodes) {
    if (node.type === 'blockquote' || node.type === 'list') {
      if (depth <= 0) {
        capped.hit = true;
        const inner =
          node.type === 'blockquote'
            ? node.children
            : node.children.flatMap((item) => item.children);
        out.push(...prepareTree(inner, 0, images, capped));
        continue;
      }
      if (node.type === 'blockquote')
        out.push({ ...node, children: prepareTree(node.children, depth - 1, images, capped) });
      else
        out.push({
          ...node,
          children: node.children.map((item) => ({
            ...item,
            children: prepareTree(item.children, depth - 1, images, capped),
          })),
        });
      continue;
    }
    if (node.type === 'table') {
      // No tables in the editor: each cell keeps its text as a paragraph (the old paste rule).
      for (const row of node.children)
        for (const cell of row.children)
          if (cell.children.length > 0)
            out.push({ type: 'paragraph', children: inline(cell.children) });
      continue;
    }
    if (node.type === 'footnoteDefinition') {
      out.push(...prepareTree(node.children, depth, images, capped));
      continue;
    }
    if (node.type === 'paragraph' || node.type === 'heading')
      out.push({ ...node, children: inline(node.children) } as MdBlock);
    else if (node.type === 'code')
      out.push({ ...node, value: node.value.replace(PLACEHOLDER_IN_TEXT, '\uFFFD') });
    else out.push(node);
  }
  return out;
}

/**
 * Project a `texuli-md/v1` tree read elsewhere (untrusted HTML through `htmlToMarkdownTree`)
 * onto a valid editor document with the same rules as `fromMarkdown`: headings past 4 clamp,
 * every link passes `safeHref` at `trust` (default `untrusted`), the document caps apply, and
 * each degradation is reported once. Never throws.
 */
export function fromMarkdownTree(
  tree: MdRoot,
  options: MarkdownTreeReadOptions = {}
): EditorLoadResult {
  const budget = new LoadBudget(options);
  const capped = { hit: false };
  const children = Array.isArray(tree?.children) ? tree.children : [];
  const prepared = prepareTree(children, budget.limits.depth, options.images ?? 'media', capped);
  const blocks = new Projector(budget).blocks(prepared);
  if (capped.hit)
    budget.report('depth-capped', 'Lists and quotes nested past the depth cap became text.');
  return {
    doc: normalizeDocument({ version: 1, blocks }, budget.newId),
    diagnostics: budget.diagnostics,
  };
}

export /** Reads a raw HTML block's source as inline Markdown (literal tags stay text). */
type RawHtmlReader = (source: string) => readonly MdInline[];

/** No parser: a raw HTML block is its literal text (trees from other readers carry none). */
const literalRawHtml: RawHtmlReader = (source) => [{ type: 'text', value: source }];

export class Projector {
  readonly budget: LoadBudget;
  /**
   * Injected so a projection that never meets raw HTML (`fromMarkdownTree`) does not pull the
   * Markdown parser into its bundle.
   */
  private readonly rawHtml: RawHtmlReader;

  constructor(budget: LoadBudget, rawHtml: RawHtmlReader = literalRawHtml) {
    this.budget = budget;
    this.rawHtml = rawHtml;
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
        const children = this.rawHtml(node.value);
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

export const isEmptyText = (block: EditorBlock) =>
  (block.type === 'paragraph' || block.type === 'heading') && block.content.length === 0;

export type Run = { text: string; marks: readonly EditorMark[] } | null;

/**
 * Move whitespace and trailing backslashes out of strong, em and strike spans
 * (Markdown cannot open or close there). Works on runs, splitting a run only
 * where a span edge moves: one pass per mark type, no object per character.
 */
export function prepareMarks(content: readonly EditorInline[]): EditorInline[] {
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

export /** Paragraph edges are trimmed when read, so they are trimmed when written. */
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
