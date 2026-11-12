/**
 * `parseMarkdown`: CommonMark 0.31.2 into the `texuli-md/v1` AST (ADR-034). Never throws on
 * input, runs in time linear in the source, and enforces `MARKDOWN_LIMITS` (the caller may lower
 * them): an over-long source is cut, block nesting stops opening containers, inline nesting
 * flattens deeper emphasis and links into their content, and a tree stops growing at the node
 * limit. Each cut is a diagnostic.
 */
import {
  MARKDOWN_AST_VERSION,
  MARKDOWN_LIMITS,
  type MarkdownDiagnostic,
  type MarkdownReadResult,
  type MdBlock,
  type MdInline,
  type MdListItem,
  type MdRoot,
} from './ast.ts';
import { type BlockNode, BlockParser, type ListData } from './block.ts';
import { type InlineNode, InlineParser, type ReferenceMap } from './inline.ts';
import { unescapeString } from './scan.ts';

export interface MarkdownLimits {
  readonly source: number;
  readonly blockDepth: number;
  readonly inlineDepth: number;
  readonly nodes: number;
}

export interface MarkdownParseOptions {
  /** Lower limits for this parse; a value above `MARKDOWN_LIMITS` is clamped to it. */
  readonly limits?: Partial<MarkdownLimits>;
}

function limitsOf(options: MarkdownParseOptions | undefined): MarkdownLimits {
  const pick = (key: keyof MarkdownLimits): number => {
    const max = MARKDOWN_LIMITS[key];
    const asked = options?.limits?.[key];
    if (typeof asked !== 'number' || !Number.isFinite(asked) || asked < 0) return max;
    return Math.min(max, Math.floor(asked));
  };
  return {
    source: pick('source'),
    blockDepth: pick('blockDepth'),
    inlineDepth: pick('inlineDepth'),
    nodes: pick('nodes'),
  };
}

/** Trim spaces, tabs and line endings (not other Unicode whitespace) from both ends. */
function trimMarkdown(text: string): string {
  let start = 0;
  let end = text.length;
  const space = (c: number) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
  while (start < end && space(text.charCodeAt(start))) start++;
  while (end > start && space(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

class Builder {
  readonly diagnostics: MarkdownDiagnostic[] = [];
  private nodes = 0;
  private full = false;
  private flattened = false;

  private readonly limits: MarkdownLimits;
  private readonly inline: InlineParser;

  constructor(limits: MarkdownLimits, inline: InlineParser) {
    this.limits = limits;
    this.inline = inline;
  }

  /** Count one node; false once the tree is full. */
  private take(): boolean {
    if (this.full) return false;
    if (this.nodes >= this.limits.nodes) {
      this.full = true;
      this.diagnostics.push({
        code: 'node-limit',
        message: `The tree reached ${this.limits.nodes} nodes; the rest of the document was dropped.`,
      });
      return false;
    }
    this.nodes++;
    return true;
  }

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
          items.push({ type: 'listItem', spread: spread(item), children: this.blocks(item) });
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

  private inlines(content: string): MdInline[] {
    const root = this.inline.parse(content);
    return this.convert(root.first, 0);
  }

  private convert(first: InlineNode | null, depth: number): MdInline[] {
    const out: MdInline[] = [];
    for (let node = first; node !== null; node = node.next) {
      if (this.full) break;
      switch (node.kind) {
        case 'text':
          this.text(out, node.value);
          break;
        case 'softbreak':
          this.text(out, '\n');
          break;
        case 'linebreak':
          if (this.take()) out.push({ type: 'break' });
          break;
        case 'code':
          if (this.take()) out.push({ type: 'inlineCode', value: node.value });
          break;
        case 'html':
          if (this.take()) out.push({ type: 'html', value: node.value });
          break;
        case 'image':
          if (this.take())
            out.push({
              type: 'image',
              url: node.url ?? '',
              alt: plainText(node),
              ...(node.title ? { title: node.title } : {}),
            });
          break;
        default:
          if (depth >= this.limits.inlineDepth) {
            this.flatten(out, node);
            break;
          }
          if (!this.take()) break;
          if (node.kind === 'link')
            out.push({
              type: 'link',
              url: node.url ?? '',
              ...(node.title ? { title: node.title } : {}),
              children: this.convert(node.first, depth + 1),
            });
          else
            out.push({
              type: node.kind === 'emph' ? 'emphasis' : 'strong',
              children: this.convert(node.first, depth + 1),
            });
      }
    }
    return out;
  }

  /** Past the inline depth limit: keep the leaves of `node` in order, without recursion. */
  private flatten(out: MdInline[], node: InlineNode): void {
    if (!this.flattened) {
      this.flattened = true;
      this.diagnostics.push({
        code: 'depth-limit',
        message: `Inline nesting deeper than ${this.limits.inlineDepth} levels was flattened into its content.`,
      });
    }
    let current: InlineNode | null = node.first;
    while (current !== null && !this.full) {
      if (
        (current.kind === 'emph' || current.kind === 'strong' || current.kind === 'link') &&
        current.first
      ) {
        current = current.first;
        continue;
      }
      this.convertLeaf(out, current);
      // Next in document order within `node`.
      while (current !== null && current.next === null) {
        current = current.parent;
        if (current === node) current = null;
      }
      if (current !== null) current = current.next;
    }
  }

  private convertLeaf(out: MdInline[], node: InlineNode): void {
    if (node.kind === 'text') this.text(out, node.value);
    else if (node.kind === 'softbreak') this.text(out, '\n');
    else if (node.kind === 'linebreak') {
      if (this.take()) out.push({ type: 'break' });
    } else if (node.kind === 'code') {
      if (this.take()) out.push({ type: 'inlineCode', value: node.value });
    } else if (node.kind === 'html') {
      if (this.take()) out.push({ type: 'html', value: node.value });
    } else if (node.kind === 'image') {
      if (this.take())
        out.push({
          type: 'image',
          url: node.url ?? '',
          alt: plainText(node),
          ...(node.title ? { title: node.title } : {}),
        });
    }
  }

  private text(out: MdInline[], value: string): void {
    if (value === '') return;
    const last = out[out.length - 1];
    if (last && last.type === 'text') {
      out[out.length - 1] = { type: 'text', value: last.value + value };
      return;
    }
    if (this.take()) out.push({ type: 'text', value });
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

/** The plain text of an image description (its alt text), without recursion. */
function plainText(node: InlineNode): string {
  let text = '';
  let current: InlineNode | null = node.first;
  while (current !== null) {
    if (current.kind === 'text' || current.kind === 'code') text += current.value;
    else if (current.kind === 'softbreak' || current.kind === 'linebreak') text += '\n';
    if (current.first) {
      current = current.first;
      continue;
    }
    while (current !== null && current.next === null) {
      current = current.parent;
      if (current === node) current = null;
    }
    if (current !== null) current = current.next;
  }
  return text;
}

const emptyRoot = (): MdRoot => ({ type: 'root', version: MARKDOWN_AST_VERSION, children: [] });

/**
 * Parse CommonMark 0.31.2 into the `texuli-md/v1` AST. Never throws: a non-string source reads as
 * empty, and every limit it hits is reported in `diagnostics`.
 */
export function parseMarkdown(source: unknown, options?: MarkdownParseOptions): MarkdownReadResult {
  const limits = limitsOf(options);
  const diagnostics: MarkdownDiagnostic[] = [];
  let text = typeof source === 'string' ? source : '';
  if (text.length > limits.source) {
    // Never split a surrogate pair.
    let cut = limits.source;
    const before = text.charCodeAt(cut - 1);
    if (before >= 0xd800 && before <= 0xdbff) cut--;
    diagnostics.push({
      code: 'source-truncated',
      message: `The source is longer than ${limits.source} characters; the rest was dropped.`,
      position: { start: cut, end: text.length },
    });
    text = text.slice(0, cut);
  }
  try {
    const refmap: ReferenceMap = new Map();
    const inline = new InlineParser(refmap);
    let depthReported = false;
    const blocks = new BlockParser(inline, {
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
    const builder = new Builder(limits, inline);
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
