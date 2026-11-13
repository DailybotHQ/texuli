/**
 * `parseMarkdown`: CommonMark 0.31.2 into the `texuli-md/v1` AST (ADR-034). Never throws on
 * input, runs in time linear in the source, and enforces `MARKDOWN_LIMITS` (the caller may lower
 * them): an over-long source is cut, block nesting stops opening containers, inline nesting
 * flattens deeper emphasis and links into their content, and a tree stops growing at the node
 * limit. Each cut is a diagnostic.
 */
import {
  MARKDOWN_AST_VERSION,
  type MarkdownDiagnostic,
  type MarkdownReadResult,
  type MdBlock,
  type MdListItem,
  type MdRoot,
  type MdTableCell,
  type MdTableRow,
} from './ast.ts';
import { type BlockNode, BlockParser, type ListData } from './block.ts';
import { boundedSource, InlineBuilder, limitsOf, type MarkdownParseOptions } from './convert.ts';
import { splitTableRow, tableCellSource, taskMarker } from './gfm/blocks.ts';
import { gfmFlags } from './gfm/options.ts';
import { InlineParser, type ReferenceMap } from './inline.ts';
import { normalizeLabel, unescapeString } from './scan.ts';

export type { MarkdownInlineResult, MarkdownLimits, MarkdownParseOptions } from './convert.ts';
export { parseInlineMarkdown } from './convert.ts';

/** Trim spaces, tabs and line endings (not other Unicode whitespace) from both ends. */
function trimMarkdown(text: string): string {
  let start = 0;
  let end = text.length;
  const space = (c: number) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
  while (start < end && space(text.charCodeAt(start))) start++;
  while (end > start && space(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

export class Builder extends InlineBuilder {
  blocks(parent: BlockNode): MdBlock[] {
    const out: MdBlock[] = [];
    for (const child of parent.children) {
      if (this.full) break;
      const block = this.block(child);
      if (block) out.push(block);
    }
    return out;
  }

  private block(node: BlockNode): MdBlock | null {
    if (!this.take()) return null;
    switch (node.kind) {
      case 'paragraph':
        return { type: 'paragraph', children: this.inlines(trimMarkdown(node.content)) };
      case 'heading':
        return {
          type: 'heading',
          depth: Math.min(6, Math.max(1, node.level)) as 1 | 2 | 3 | 4 | 5 | 6,
          children: this.inlines(trimMarkdown(node.content)),
        };
      case 'thematicBreak':
        return { type: 'thematicBreak' };
      case 'blockquote':
        return { type: 'blockquote', children: this.blocks(node) };
      case 'list': {
        const data = node.list as ListData;
        const items: MdListItem[] = [];
        for (const item of node.children) {
          if (!this.take()) break;
          // GFM task list item: `[ ]` or `[x]` opening the item's first paragraph.
          const first = item.children[0];
          const task =
            this.gfm.taskList && first?.kind === 'paragraph' ? taskMarker(first.content) : null;
          if (task && first) first.content = first.content.slice(task.length);
          items.push(
            task
              ? {
                  type: 'listItem',
                  spread: spread(item),
                  checked: task.checked,
                  children: this.blocks(item),
                }
              : { type: 'listItem', spread: spread(item), children: this.blocks(item) }
          );
        }
        return data.type === 'ordered'
          ? { type: 'list', ordered: true, start: data.start, spread: !node.tight, children: items }
          : { type: 'list', ordered: false, spread: !node.tight, children: items };
      }
      case 'code': {
        const value = node.content.endsWith('\n') ? node.content.slice(0, -1) : node.content;
        if (!node.fenced) return { type: 'code', value, fenced: false };
        const info = unescapeString(trimMarkdown(node.info));
        const space = info.search(/[ \t]/);
        const lang = space < 0 ? info : info.slice(0, space);
        const meta = space < 0 ? '' : trimMarkdown(info.slice(space));
        return {
          type: 'code',
          ...(lang ? { lang } : {}),
          ...(meta ? { meta } : {}),
          value,
          fenced: true,
        };
      }
      case 'html':
        return { type: 'html', value: node.content };
      case 'table': {
        const align = node.align ?? [];
        const rows: MdTableRow[] = [];
        const header = this.tableRow(node.header, align.length);
        if (header) rows.push(header);
        let from = 0;
        while (from < node.content.length && !this.full) {
          let to = node.content.indexOf('\n', from);
          if (to < 0) to = node.content.length;
          const row = this.tableRow(node.content.slice(from, to), align.length);
          if (row) rows.push(row);
          from = to + 1;
        }
        return { type: 'table', align, children: rows };
      }
      case 'footnoteDefinition':
        return { type: 'footnoteDefinition', label: node.label, children: this.blocks(node) };
      case 'definition': {
        const definition = node.definition as { label: string; url: string; title?: string };
        return {
          type: 'definition',
          label: definition.label,
          url: definition.url,
          ...(definition.title !== undefined ? { title: definition.title } : {}),
        };
      }
      default:
        return null;
    }
  }

  /** One table row: exactly `columns` cells (extra cells dropped, missing ones empty). */
  private tableRow(line: string, columns: number): MdTableRow | null {
    if (!this.take()) return null;
    const raw = splitTableRow(line);
    const cells: MdTableCell[] = [];
    for (let i = 0; i < columns; i++) {
      if (!this.take()) break;
      cells.push({ type: 'tableCell', children: this.inlines(tableCellSource(raw[i] ?? '')) });
    }
    return { type: 'tableRow', children: cells };
  }
}

/** Whether a list item's direct children are separated by a blank line. */
function spread(item: BlockNode): boolean {
  for (let i = 0; i + 1 < item.children.length; i++) {
    const a = item.children[i] as BlockNode;
    const b = item.children[i + 1] as BlockNode;
    if (a.endLine !== b.startLine - 1) return true;
  }
  return false;
}

const emptyRoot = (): MdRoot => ({ type: 'root', version: MARKDOWN_AST_VERSION, children: [] });

/**
 * Parse CommonMark 0.31.2 into the `texuli-md/v1` AST. Never throws: a non-string source reads as
 * empty, and every limit it hits is reported in `diagnostics`.
 */
export function parseMarkdown(source: unknown, options?: MarkdownParseOptions): MarkdownReadResult {
  const limits = limitsOf(options);
  const diagnostics: MarkdownDiagnostic[] = [];
  const text = boundedSource(source, limits, diagnostics);
  try {
    const refmap: ReferenceMap = new Map();
    const gfm = gfmFlags(options?.gfm);
    const footnotes = new Map<string, string>();
    const inline = new InlineParser(refmap, { gfm, footnotes });
    let depthReported = false;
    const blocks = new BlockParser(inline, {
      gfm,
      footnotes,
      normalizeLabel,
      blockDepth: limits.blockDepth,
      onDepthLimit: () => {
        if (depthReported) return;
        depthReported = true;
        diagnostics.push({
          code: 'depth-limit',
          message: `Block quotes and lists nested deeper than ${limits.blockDepth} levels were read as text.`,
        });
      },
    });
    const doc = blocks.parse(text);
    const builder = new Builder(limits, inline, gfm);
    const children = builder.blocks(doc);
    diagnostics.push(...builder.diagnostics);
    return { tree: { type: 'root', version: MARKDOWN_AST_VERSION, children }, diagnostics };
  } catch {
    diagnostics.push({
      code: 'unsupported-construct',
      message: 'The Markdown reader stopped on an internal error; the document was dropped.',
    });
    return { tree: emptyRoot(), diagnostics };
  }
}
