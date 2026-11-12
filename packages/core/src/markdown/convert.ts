/**
 * Inline reading shared by `parseMarkdown` and `parseInlineMarkdown` (ADR-034): the inline
 * parser's linked nodes into `texuli-md/v1` inlines, under the node and inline depth limits.
 * This module never imports the block parser, so a bundle that only reads inline content
 * (chat messages, catalog rich text) leaves it out.
 */
import { MARKDOWN_LIMITS, type MarkdownDiagnostic, type MdInline } from './ast.ts';
import { type GfmFlags, type GfmOptions, gfmFlags } from './gfm/options.ts';
import { type InlineNode, InlineParser } from './inline.ts';

export interface MarkdownLimits {
  readonly source: number;
  readonly blockDepth: number;
  readonly inlineDepth: number;
  readonly nodes: number;
}

export interface MarkdownParseOptions {
  /** Lower limits for this parse; a value above `MARKDOWN_LIMITS` is clamped to it. */
  readonly limits?: Partial<MarkdownLimits>;
  /**
   * GFM 0.29 extensions: on by default (`true` or omitted); `false` reads strict CommonMark
   * 0.31.2; an object turns single extensions off (`{ footnote: false }`).
   */
  readonly gfm?: boolean | GfmOptions;
}

export function limitsOf(options: MarkdownParseOptions | undefined): MarkdownLimits {
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

/** The source cut to the limit (never splitting a surrogate pair), with its diagnostic. */
export function boundedSource(
  source: unknown,
  limits: MarkdownLimits,
  diagnostics: MarkdownDiagnostic[]
): string {
  const text = typeof source === 'string' ? source : '';
  if (text.length <= limits.source) return text;
  let cut = limits.source;
  const before = text.charCodeAt(cut - 1);
  if (before >= 0xd800 && before <= 0xdbff) cut--;
  diagnostics.push({
    code: 'source-truncated',
    message: `The source is longer than ${limits.source} characters; the rest was dropped.`,
    position: { start: cut, end: text.length },
  });
  return text.slice(0, cut);
}

export class InlineBuilder {
  readonly diagnostics: MarkdownDiagnostic[] = [];
  protected nodes = 0;
  protected full = false;
  protected flattened = false;

  protected readonly limits: MarkdownLimits;
  protected readonly inline: InlineParser;
  protected readonly gfm: GfmFlags;
  /** Inline-only reads: links and images carry their source position. */
  positions = false;

  constructor(limits: MarkdownLimits, inline: InlineParser, gfm: GfmFlags) {
    this.limits = limits;
    this.inline = inline;
    this.gfm = gfm;
  }

  private where(node: InlineNode): { position?: { start: number; end: number } } {
    return this.positions && node.start !== undefined && node.end !== undefined
      ? { position: { start: node.start, end: node.end } }
      : {};
  }

  /** Count one node; false once the tree is full. */
  protected take(): boolean {
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

  inlines(content: string): MdInline[] {
    const root = this.inline.parse(content);
    return this.convert(root.first, 0, false);
  }

  private convert(first: InlineNode | null, depth: number, inLink: boolean): MdInline[] {
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
        case 'footnoteReference':
          if (this.take()) out.push({ type: 'footnoteReference', label: node.value });
          break;
        case 'image':
          if (this.take())
            out.push({
              type: 'image',
              url: node.url ?? '',
              alt: plainText(node),
              ...(node.title ? { title: node.title } : {}),
              ...this.where(node),
            });
          break;
        default:
          if (depth >= this.limits.inlineDepth || (inLink && node.kind === 'link')) {
            // Past the depth limit, or a GFM autolink inside a link (no links in links).
            this.flatten(out, node, !inLink || node.kind !== 'link');
            break;
          }
          if (!this.take()) break;
          if (node.kind === 'link')
            out.push({
              type: 'link',
              url: node.url ?? '',
              ...(node.title ? { title: node.title } : {}),
              children: this.convert(node.first, depth + 1, true),
              ...this.where(node),
            });
          else
            out.push({
              type:
                node.kind === 'emph' ? 'emphasis' : node.kind === 'delete' ? 'delete' : 'strong',
              children: this.convert(node.first, depth + 1, inLink),
            });
      }
    }
    return out;
  }

  /** Past the inline depth limit: keep the leaves of `node` in order, without recursion. */
  private flatten(out: MdInline[], node: InlineNode, report = true): void {
    if (report && !this.flattened) {
      this.flattened = true;
      this.diagnostics.push({
        code: 'depth-limit',
        message: `Inline nesting deeper than ${this.limits.inlineDepth} levels was flattened into its content.`,
      });
    }
    let current: InlineNode | null = node.first;
    while (current !== null && !this.full) {
      if (
        (current.kind === 'emph' ||
          current.kind === 'strong' ||
          current.kind === 'delete' ||
          current.kind === 'link') &&
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
    } else if (node.kind === 'footnoteReference') {
      if (this.take()) out.push({ type: 'footnoteReference', label: node.value });
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

export interface MarkdownInlineResult {
  readonly children: readonly MdInline[];
  readonly diagnostics: readonly MarkdownDiagnostic[];
}

/**
 * Parse `source` as inline content only (no block structure: a leading `#`, `-` or `>` stays
 * text), the way a paragraph's text is read. For closed inline vocabularies (chat messages,
 * catalog rich text) that split blocks themselves. Line endings become soft or hard breaks;
 * link reference definitions and footnotes have nothing to resolve against. Inline links and
 * images carry `position` (offsets into `source` with line endings read as `\n`), so a filter
 * can keep a refused one exactly as written. Never throws.
 */
export function parseInlineMarkdown(
  source: unknown,
  options?: MarkdownParseOptions
): MarkdownInlineResult {
  const limits = limitsOf(options);
  const diagnostics: MarkdownDiagnostic[] = [];
  const text = boundedSource(source, limits, diagnostics)
    .replace(/\r\n?/g, '\n')
    .split('\u0000')
    .join('\uFFFD');
  try {
    const gfm = gfmFlags(options?.gfm);
    const inline = new InlineParser(new Map(), { gfm, footnotes: new Map() });
    const builder = new InlineBuilder(limits, inline, gfm);
    builder.positions = true;
    const children = builder.inlines(text);
    diagnostics.push(...builder.diagnostics);
    return { children, diagnostics };
  } catch {
    diagnostics.push({
      code: 'unsupported-construct',
      message: 'The Markdown reader stopped on an internal error; the text was dropped.',
    });
    return { children: [], diagnostics };
  }
}
