import {
  type MdBlock as CoreBlock,
  type MdInline as CoreInline,
  type MdListItem as CoreListItem,
  parseMarkdown as parseCommonMark,
  parseInlineMarkdown,
} from '@texuli/core/markdown';
import { safeHref } from '@texuli/core/url-policy';

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
 *
 * The text is read by the shared CommonMark parser (`@texuli/core/markdown`,
 * ADR-034; GFM strikethrough and task items only) and filtered down to this
 * tree: setext headings read as headings and indented code as code, raw HTML
 * stays literal text, link reference definitions resolve their links and are
 * not shown, and images keep their alt text.
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

/** What the shared reader may produce for text blocks: no tables, footnotes or bare autolinks. */
const GFM = { table: false, footnote: false, autolink: false, strikethrough: true, taskList: true };
const FENCE_LANG = /^[a-z][a-z0-9+-]{0,31}$/i;

/** Parses validated block text into the closed Markdown tree. */
export function parseMarkdown(source: string): MdDocument {
  // CR LF, CR, U+2028 and U+2029 all end a line.
  const text = String(source)
    .slice(0, MARKDOWN_LIMITS.source)
    .replace(/\r\n?|[\u2028\u2029]/g, '\n');
  const { tree } = parseCommonMark(text, {
    gfm: GFM,
    limits: {
      source: MARKDOWN_LIMITS.source,
      blockDepth: MARKDOWN_LIMITS.blockDepth,
      inlineDepth: MARKDOWN_LIMITS.inlineDepth,
    },
  });
  return { blocks: projectBlocks(tree.children) };
}

function projectBlocks(nodes: readonly CoreBlock[]): MdBlock[] {
  const out: MdBlock[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out.push({ type: 'paragraph', children: projectInlines(node.children) });
        break;
      case 'heading':
        out.push({ type: 'heading', level: node.depth, children: projectInlines(node.children) });
        break;
      case 'thematicBreak':
        out.push({ type: 'rule' });
        break;
      case 'blockquote':
        out.push({ type: 'quote', children: projectBlocks(node.children) });
        break;
      case 'list':
        out.push({
          type: 'list',
          ordered: node.ordered,
          start: node.ordered ? (node.start ?? 1) : 1,
          items: node.children.map((item: CoreListItem) => ({
            checked: item.checked ?? null,
            children: projectBlocks(item.children),
          })),
        });
        break;
      case 'code': {
        const lang =
          node.lang && !node.meta && FENCE_LANG.test(node.lang)
            ? node.lang.toLowerCase()
            : undefined;
        out.push({ type: 'code', lang, text: node.value });
        break;
      }
      case 'html':
        // Raw HTML is never markup: the block reads as a paragraph whose tags stay literal text.
        out.push({ type: 'paragraph', children: parseInline(node.value, 0) });
        break;
      default:
        // Definitions resolve their links and are not shown; nothing else is produced.
        break;
    }
  }
  return out;
}

function projectInlines(nodes: readonly CoreInline[]): MdInline[] {
  const out: MdInline[] = [];
  const text = (value: string) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last?.type === 'text') out[out.length - 1] = { type: 'text', text: last.text + value };
    else out.push({ type: 'text', text: value });
  };
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'html':
        // Raw HTML stays literal text.
        text(node.value);
        break;
      case 'image':
        // Images are not loaded from text blocks: keep the alt text only.
        text(node.alt);
        break;
      case 'inlineCode':
        out.push({ type: 'code', text: node.value });
        break;
      case 'break':
        out.push({ type: 'break' });
        break;
      case 'strong':
        out.push({ type: 'strong', children: projectInlines(node.children) });
        break;
      case 'emphasis':
        out.push({ type: 'em', children: projectInlines(node.children) });
        break;
      case 'delete':
        out.push({ type: 'del', children: projectInlines(node.children) });
        break;
      case 'link':
        out.push({
          type: 'link',
          href: safeHref(node.url, 'untrusted') ?? undefined,
          children: projectInlines(node.children),
        });
        break;
      default:
        if ('children' in node)
          for (const child of projectInlines(node.children as CoreInline[])) {
            if (child.type === 'text') text(child.text);
            else out.push(child);
          }
    }
  }
  return out;
}

/** Parses inline Markdown; `depth` is the nesting already open (caps nested emphasis and links). */
export function parseInline(source: string, depth: number, _inLink = false): MdInline[] {
  const { children } = parseInlineMarkdown(String(source), {
    gfm: GFM,
    limits: { inlineDepth: Math.max(0, MARKDOWN_LIMITS.inlineDepth - depth) },
  });
  return projectInlines(children);
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
