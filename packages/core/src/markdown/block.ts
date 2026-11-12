/**
 * CommonMark 0.31.2 block parser (§4, §5 and appendix "A parsing strategy"): each line first
 * continues the open containers (block quotes, list items), then may open new blocks, then adds
 * its text to the deepest open leaf (or continues a paragraph lazily). Leaf blocks keep their
 * raw content; inline content is parsed afterwards, once every link reference definition is
 * known. Container nesting stops at the block depth limit: a marker past it stays text.
 */
import type { MdAlign } from './ast.ts';
import { footnoteDefinitionStart, parseDelimiterRow, splitTableRow } from './gfm/blocks.ts';
import { GFM_OFF, type GfmFlags } from './gfm/options.ts';
import { type InlineParser } from './inline.ts';
import { isHtmlBlock7Line, isSpaceOrTab } from './scan.ts';

export type BlockKind =
  | 'document'
  | 'blockquote'
  | 'list'
  | 'item'
  | 'paragraph'
  | 'heading'
  | 'thematicBreak'
  | 'code'
  | 'html'
  | 'definition'
  | 'table'
  | 'footnoteDefinition';

export interface ListData {
  readonly type: 'bullet' | 'ordered';
  readonly bulletChar: string;
  readonly start: number;
  readonly delimiter: string;
  readonly padding: number;
  readonly markerOffset: number;
}

export interface BlockNode {
  kind: BlockKind;
  parent: BlockNode | null;
  children: BlockNode[];
  open: boolean;
  startLine: number;
  endLine: number;
  /** Raw text of a paragraph, heading, code or HTML block. */
  content: string;
  level: number;
  fenced: boolean;
  fenceChar: string;
  fenceLength: number;
  fenceOffset: number;
  info: string;
  htmlType: number;
  list: ListData | null;
  tight: boolean;
  /** Container depth: block quotes and lists from the root down to this node. */
  depth: number;
  definition: { label: string; url: string; title?: string } | null;
  /** GFM: a footnote definition's label as written. */
  label: string;
  /** GFM: a table's column alignments and its header row (raw). */
  align: MdAlign[] | null;
  header: string;
}

function blockNode(kind: BlockKind, line: number, parent: BlockNode | null): BlockNode {
  const containerStep =
    kind === 'blockquote' || kind === 'list' || kind === 'footnoteDefinition' ? 1 : 0;
  return {
    kind,
    parent,
    children: [],
    open: true,
    startLine: line,
    endLine: line,
    content: '',
    level: 0,
    fenced: false,
    fenceChar: '',
    fenceLength: 0,
    fenceOffset: 0,
    info: '',
    htmlType: 0,
    list: null,
    tight: true,
    depth: (parent?.depth ?? 0) + containerStep,
    definition: null,
    label: '',
    align: null,
    header: '',
  };
}

const lastChild = (node: BlockNode): BlockNode | undefined =>
  node.children[node.children.length - 1];

const CODE_INDENT = 4;

const HTML_OPEN: readonly RegExp[] = [
  /./, // unused (types are 1-based)
  /^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
  /^<!--/,
  /^<[?]/,
  /^<![A-Za-z]/,
  /^<!\[CDATA\[/,
  /^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
];

const HTML_CLOSE: readonly RegExp[] = [
  /./,
  /<\/(?:script|pre|textarea|style)>/i,
  /-->/,
  /\?>/,
  />/,
  /\]\]>/,
];

const ATX_MARKER = /^#{1,6}(?:[ \t]+|$)/;
const CODE_FENCE = /^`{3,}(?!.*`)|^~{3,}/;
const CLOSING_FENCE = /^(?:`{3,}|~{3,})(?=[ \t]*$)/;
const SETEXT_LINE = /^(?:=+|-+)[ \t]*$/;
const THEMATIC_BREAK = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/;
const BULLET_MARKER = /^[*+-]/;
const ORDERED_MARKER = /^(\d{1,9})([.)])/;
const MAYBE_SPECIAL = /^[#`~*+_=<>0-9\-|:[]/;

const acceptsLines = (kind: BlockKind) =>
  kind === 'paragraph' || kind === 'code' || kind === 'html' || kind === 'table';

/** A paragraph or a GFM table: open text that block starts may interrupt. */
const isTextLeaf = (kind: BlockKind) => kind === 'paragraph' || kind === 'table';

function canContain(parent: BlockKind, child: BlockKind): boolean {
  if (
    parent === 'document' ||
    parent === 'blockquote' ||
    parent === 'item' ||
    parent === 'footnoteDefinition'
  )
    return child !== 'item';
  if (parent === 'list') return child === 'item';
  return false;
}

/** Strip an ATX heading's closing sequence (` ###`) and surrounding spaces, without regex backtracking. */
function atxContent(text: string): string {
  let end = text.length;
  while (end > 0 && isSpaceOrTab(text.charCodeAt(end - 1))) end--;
  let hashes = end;
  while (hashes > 0 && text.charCodeAt(hashes - 1) === 0x23) hashes--;
  if (hashes < end && (hashes === 0 || isSpaceOrTab(text.charCodeAt(hashes - 1)))) end = hashes;
  let start = 0;
  while (start < end && isSpaceOrTab(text.charCodeAt(start))) start++;
  while (end > start && isSpaceOrTab(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

function isBlankText(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false;
  }
  return true;
}

export interface BlockParseOptions {
  readonly blockDepth: number;
  readonly onDepthLimit: (line: number) => void;
  readonly gfm?: GfmFlags;
  /** Filled with footnote definition labels (normalized label → label as written). */
  readonly footnotes?: Map<string, string>;
  readonly normalizeLabel?: (label: string) => string;
}

export class BlockParser {
  readonly doc: BlockNode = blockNode('document', 0, null);
  private tip: BlockNode = this.doc;
  private oldtip: BlockNode = this.doc;
  private line = '';
  private lineNumber = 0;
  private offset = 0;
  private column = 0;
  private nextNonspace = 0;
  private nextNonspaceColumn = 0;
  private indent = 0;
  private indented = false;
  private blank = false;
  private partiallyConsumedTab = false;
  private allClosed = true;
  private lastMatchedContainer: BlockNode = this.doc;

  private readonly inline: InlineParser;
  private readonly options: BlockParseOptions;
  private readonly gfm: GfmFlags;

  constructor(inline: InlineParser, options: BlockParseOptions) {
    this.inline = inline;
    this.options = options;
    this.gfm = options.gfm ?? GFM_OFF;
  }

  /** Parse `source` (already bounded) into the block tree. */
  parse(source: string): BlockNode {
    const lines = source.split(/\r\n|\n|\r/);
    let count = lines.length;
    const last = source.charCodeAt(source.length - 1);
    if (last === 0x0a || last === 0x0d) count--;
    for (let i = 0; i < count; i++) this.incorporateLine(lines[i] as string);
    while (this.tip !== this.doc) this.finalize(this.tip, count);
    this.finalize(this.doc, count);
    return this.doc;
  }

  private peek(at: number): number {
    return at < this.line.length ? this.line.charCodeAt(at) : -1;
  }

  private findNextNonspace(): void {
    let i = this.offset;
    let cols = this.column;
    let c = this.peek(i);
    while (c === 0x20 || c === 0x09) {
      if (c === 0x20) cols++;
      else cols += 4 - (cols % 4);
      i++;
      c = this.peek(i);
    }
    this.blank = c === -1;
    this.nextNonspace = i;
    this.nextNonspaceColumn = cols;
    this.indent = this.nextNonspaceColumn - this.column;
    this.indented = this.indent >= CODE_INDENT;
  }

  private advanceNextNonspace(): void {
    this.offset = this.nextNonspace;
    this.column = this.nextNonspaceColumn;
    this.partiallyConsumedTab = false;
  }

  private advanceOffset(count: number, columns: boolean): void {
    let left = count;
    while (left > 0 && this.offset < this.line.length) {
      const c = this.line.charCodeAt(this.offset);
      if (c === 0x09) {
        const toTab = 4 - (this.column % 4);
        if (columns) {
          this.partiallyConsumedTab = toTab > left;
          const advance = toTab > left ? left : toTab;
          this.column += advance;
          this.offset += this.partiallyConsumedTab ? 0 : 1;
          left -= advance;
        } else {
          this.partiallyConsumedTab = false;
          this.column += toTab;
          this.offset += 1;
          left -= 1;
        }
      } else {
        this.partiallyConsumedTab = false;
        this.offset += 1;
        this.column += 1;
        left -= 1;
      }
    }
  }

  private addLine(): void {
    if (this.partiallyConsumedTab) {
      this.offset += 1;
      const toTab = 4 - (this.column % 4);
      this.tip.content += ' '.repeat(toTab);
    }
    this.tip.content += `${this.line.slice(this.offset)}\n`;
  }

  private addChild(kind: BlockKind): BlockNode {
    while (!canContain(this.tip.kind, kind)) this.finalize(this.tip, this.lineNumber - 1);
    const child = blockNode(kind, this.lineNumber, this.tip);
    this.tip.children.push(child);
    this.tip = child;
    return child;
  }

  private closeUnmatchedBlocks(): void {
    if (this.allClosed) return;
    while (this.oldtip !== this.lastMatchedContainer) {
      const parent = this.oldtip.parent as BlockNode;
      this.finalize(this.oldtip, this.lineNumber - 1);
      this.oldtip = parent;
    }
    this.allClosed = true;
  }

  /** Whether a new block quote or list may open under `container` (the block depth limit). */
  private roomFor(container: BlockNode): boolean {
    if (container.depth < this.options.blockDepth) return true;
    this.options.onDepthLimit(this.lineNumber);
    return false;
  }

  private incorporateLine(raw: string): void {
    let container = this.doc;
    this.oldtip = this.tip;
    this.offset = 0;
    this.column = 0;
    this.blank = false;
    this.partiallyConsumedTab = false;
    this.lineNumber++;
    this.line = raw.indexOf('\u0000') >= 0 ? raw.split('\u0000').join('\uFFFD') : raw;

    for (;;) {
      const child = lastChild(container);
      if (!child?.open) break;
      container = child;
      this.findNextNonspace();
      const result = this.continueBlock(container);
      if (result === 0) continue;
      if (result === 1) {
        container = container.parent as BlockNode;
        break;
      }
      return; // 2: the line was consumed (a closing fence)
    }
    this.allClosed = container === this.oldtip;
    this.lastMatchedContainer = container;

    let matchedLeaf = !isTextLeaf(container.kind) && acceptsLines(container.kind);
    while (!matchedLeaf) {
      this.findNextNonspace();
      if (
        !this.indented &&
        !MAYBE_SPECIAL.test(this.line.slice(this.nextNonspace, this.nextNonspace + 1))
      ) {
        this.advanceNextNonspace();
        break;
      }
      const result = this.startBlock(container);
      if (result === 3) return; // the line was consumed (a table's delimiter row)
      if (result === 1) {
        container = this.tip;
        continue;
      }
      if (result === 2) {
        container = this.tip;
        matchedLeaf = true;
        break;
      }
      this.advanceNextNonspace();
      break;
    }

    if (!this.allClosed && !this.blank && this.tip.kind === 'paragraph') {
      // A lazy paragraph continuation line.
      this.addLine();
      return;
    }
    this.closeUnmatchedBlocks();
    if (acceptsLines(container.kind)) {
      this.addLine();
      if (
        container.kind === 'html' &&
        container.htmlType >= 1 &&
        container.htmlType <= 5 &&
        (HTML_CLOSE[container.htmlType] as RegExp).test(this.line.slice(this.offset))
      )
        this.finalize(container, this.lineNumber);
    } else if (this.offset < this.line.length && !this.blank) {
      this.addChild('paragraph');
      this.advanceNextNonspace();
      this.addLine();
    }
  }

  /** 0: matched, 1: not matched, 2: the line is done. */
  private continueBlock(container: BlockNode): 0 | 1 | 2 {
    switch (container.kind) {
      case 'blockquote':
        if (!this.indented && this.peek(this.nextNonspace) === 0x3e) {
          this.advanceNextNonspace();
          this.advanceOffset(1, false);
          if (isSpaceOrTab(this.peek(this.offset))) this.advanceOffset(1, true);
          return 0;
        }
        return 1;
      case 'item': {
        const data = container.list as ListData;
        if (this.blank) {
          if (container.children.length === 0) return 1;
          this.advanceNextNonspace();
          return 0;
        }
        if (this.indent >= data.markerOffset + data.padding) {
          this.advanceOffset(data.markerOffset + data.padding, true);
          return 0;
        }
        return 1;
      }
      case 'heading':
      case 'thematicBreak':
        return 1;
      case 'code': {
        if (container.fenced) {
          const rest = this.line.slice(this.nextNonspace);
          const match =
            this.indent <= 3 && rest.charAt(0) === container.fenceChar
              ? CLOSING_FENCE.exec(rest)
              : null;
          if (match && match[0].length >= container.fenceLength) {
            this.finalize(container, this.lineNumber);
            return 2;
          }
          let i = container.fenceOffset;
          while (i > 0 && isSpaceOrTab(this.peek(this.offset))) {
            this.advanceOffset(1, true);
            i--;
          }
          return 0;
        }
        if (this.indent >= CODE_INDENT) {
          this.advanceOffset(CODE_INDENT, true);
          return 0;
        }
        if (this.blank) {
          this.advanceNextNonspace();
          return 0;
        }
        return 1;
      }
      case 'html':
        return this.blank && (container.htmlType === 6 || container.htmlType === 7) ? 1 : 0;
      case 'paragraph':
      case 'table':
        return this.blank ? 1 : 0;
      case 'footnoteDefinition':
        if (this.indent >= CODE_INDENT) {
          this.advanceOffset(CODE_INDENT, true);
          return 0;
        }
        return this.blank ? 0 : 1;
      default:
        return 0;
    }
  }

  /** 0: no block starts here, 1: a container started, 2: a leaf started, 3: the line is done. */
  private startBlock(container: BlockNode): 0 | 1 | 2 | 3 {
    const rest = () => this.line.slice(this.nextNonspace);
    const c = this.peek(this.nextNonspace);
    // Block quote.
    if (!this.indented && c === 0x3e && this.roomFor(container)) {
      this.advanceNextNonspace();
      this.advanceOffset(1, false);
      if (isSpaceOrTab(this.peek(this.offset))) this.advanceOffset(1, true);
      this.closeUnmatchedBlocks();
      this.addChild('blockquote');
      return 1;
    }
    // ATX heading.
    if (!this.indented && c === 0x23) {
      const match = ATX_MARKER.exec(rest());
      if (match) {
        this.advanceNextNonspace();
        this.advanceOffset(match[0].length, false);
        this.closeUnmatchedBlocks();
        const heading = this.addChild('heading');
        heading.level = match[0].trim().length;
        heading.content = atxContent(this.line.slice(this.offset));
        this.advanceOffset(this.line.length - this.offset, false);
        return 2;
      }
    }
    // Fenced code.
    if (!this.indented && (c === 0x60 || c === 0x7e)) {
      const match = CODE_FENCE.exec(rest());
      if (match) {
        const length = match[0].length;
        this.closeUnmatchedBlocks();
        const code = this.addChild('code');
        code.fenced = true;
        code.fenceLength = length;
        code.fenceChar = match[0].charAt(0);
        code.fenceOffset = this.indent;
        this.advanceNextNonspace();
        this.advanceOffset(length, false);
        return 2;
      }
    }
    // HTML block.
    if (!this.indented && c === 0x3c) {
      const text = rest();
      for (let type = 1; type <= 7; type++) {
        const opens = type < 7 ? (HTML_OPEN[type] as RegExp).test(text) : isHtmlBlock7Line(text);
        if (
          opens &&
          (type < 7 ||
            (!isTextLeaf(container.kind) &&
              !(!this.allClosed && !this.blank && this.tip.kind === 'paragraph')))
        ) {
          this.closeUnmatchedBlocks();
          const html = this.addChild('html');
          html.htmlType = type;
          return 2;
        }
      }
    }
    // Setext heading underline.
    if (!this.indented && container.kind === 'paragraph' && (c === 0x3d || c === 0x2d)) {
      const match = SETEXT_LINE.exec(rest());
      if (match) {
        this.closeUnmatchedBlocks();
        const found = this.extractDefinitions(container);
        if (found.content.length > 0) {
          const parent = container.parent as BlockNode;
          const heading = blockNode('heading', container.startLine, parent);
          heading.level = match[0].charAt(0) === '=' ? 1 : 2;
          heading.content = found.content;
          parent.children.pop();
          parent.children.push(...found.definitions, heading);
          this.tip = heading;
          this.advanceOffset(this.line.length - this.offset, false);
          return 2;
        }
        container.content = '';
        const parent = container.parent as BlockNode;
        parent.children.pop();
        parent.children.push(...found.definitions, container);
      }
    }
    // GFM table: the paragraph's last line is the header row when this line is a matching
    // delimiter row.
    if (
      this.gfm.table &&
      !this.indented &&
      container.kind === 'paragraph' &&
      this.startTable(container)
    )
      return 3;
    // Thematic break.
    if (!this.indented && (c === 0x2a || c === 0x5f || c === 0x2d) && THEMATIC_BREAK.test(rest())) {
      this.closeUnmatchedBlocks();
      this.addChild('thematicBreak');
      this.advanceOffset(this.line.length - this.offset, false);
      return 2;
    }
    // GFM footnote definition.
    if (this.gfm.footnote && !this.indented && c === 0x5b) {
      const found = footnoteDefinitionStart(this.line, this.nextNonspace);
      if (found && this.roomFor(container)) {
        this.closeUnmatchedBlocks();
        const node = this.addChild('footnoteDefinition');
        node.label = found.label;
        const key = this.options.normalizeLabel?.(found.label) ?? found.label;
        if (this.options.footnotes && !this.options.footnotes.has(key))
          this.options.footnotes.set(key, found.label);
        this.advanceNextNonspace();
        this.advanceOffset(found.end - this.nextNonspace, false);
        return 1;
      }
    }
    // List item.
    if (!this.indented || container.kind === 'list') {
      const data = this.parseListMarker(container);
      if (data) {
        this.closeUnmatchedBlocks();
        if (
          this.tip.kind !== 'list' ||
          (this.tip.list as ListData).type !== data.type ||
          (this.tip.list as ListData).delimiter !== data.delimiter ||
          (this.tip.list as ListData).bulletChar !== data.bulletChar
        ) {
          const list = this.addChild('list');
          list.list = data;
        }
        const item = this.addChild('item');
        item.list = data;
        return 1;
      }
    }
    // Indented code.
    if (this.indented && !isTextLeaf(this.tip.kind) && !this.blank) {
      this.advanceOffset(CODE_INDENT, true);
      this.closeUnmatchedBlocks();
      this.addChild('code');
      return 2;
    }
    return 0;
  }

  /** Turn the paragraph's last line into a table header when this line is a delimiter row. */
  private startTable(paragraph: BlockNode): boolean {
    const align = parseDelimiterRow(this.line.slice(this.nextNonspace));
    if (!align) return false;
    const content = paragraph.content;
    const lastBreak = content.lastIndexOf('\n', content.length - 2);
    const header = content.slice(lastBreak + 1, content.length - 1);
    if (splitTableRow(header).length !== align.length) return false;
    this.closeUnmatchedBlocks();
    const parent = paragraph.parent as BlockNode;
    const before = content.slice(0, lastBreak + 1);
    if (isBlankText(before)) {
      parent.children.pop();
      this.tip = parent;
    } else {
      paragraph.content = before;
      this.finalize(paragraph, this.lineNumber - 2);
    }
    const table = this.addChild('table');
    table.startLine = this.lineNumber - 1;
    table.align = align;
    table.header = header;
    return true;
  }

  private parseListMarker(container: BlockNode): ListData | null {
    if (this.indent >= 4) return null;
    const rest = this.line.slice(this.nextNonspace, this.nextNonspace + 12);
    let type: 'bullet' | 'ordered';
    let bulletChar = '';
    let start = 1;
    let delimiter = '';
    let markerLength: number;
    const bullet = BULLET_MARKER.exec(rest);
    const ordered = bullet ? null : ORDERED_MARKER.exec(rest);
    if (bullet) {
      type = 'bullet';
      bulletChar = bullet[0];
      markerLength = 1;
    } else if (ordered && (!isTextLeaf(container.kind) || ordered[1] === '1')) {
      type = 'ordered';
      start = Number.parseInt(ordered[1] as string, 10);
      delimiter = ordered[2] as string;
      markerLength = ordered[0].length;
    } else return null;
    const after = this.peek(this.nextNonspace + markerLength);
    if (!(after === -1 || after === 0x09 || after === 0x20)) return null;
    if (
      isTextLeaf(container.kind) &&
      isBlankText(this.line.slice(this.nextNonspace + markerLength))
    )
      return null;
    if (!this.roomFor(container)) return null;
    const markerOffset = this.indent;
    this.advanceNextNonspace();
    this.advanceOffset(markerLength, true);
    const spacesStartCol = this.column;
    const spacesStartOffset = this.offset;
    let next: number;
    do {
      this.advanceOffset(1, true);
      next = this.peek(this.offset);
    } while (this.column - spacesStartCol < 5 && isSpaceOrTab(next));
    const blankItem = this.peek(this.offset) === -1;
    const spacesAfter = this.column - spacesStartCol;
    let padding: number;
    if (spacesAfter >= 5 || spacesAfter < 1 || blankItem) {
      padding = markerLength + 1;
      this.column = spacesStartCol;
      this.offset = spacesStartOffset;
      if (isSpaceOrTab(this.peek(this.offset))) this.advanceOffset(1, true);
    } else padding = markerLength + spacesAfter;
    return { type, bulletChar, start, delimiter, padding, markerOffset };
  }

  /** Pull link reference definitions off the start of a paragraph. */
  private extractDefinitions(paragraph: BlockNode): { content: string; definitions: BlockNode[] } {
    if (paragraph.content.charCodeAt(0) !== 0x5b)
      return { content: paragraph.content, definitions: [] };
    const { definitions, ends, rest } = this.inline.parseReferences(paragraph.content);
    let line = paragraph.startLine;
    let from = 0;
    const nodes = definitions.map((definition, index) => {
      const node = blockNode('definition', line, paragraph.parent);
      const end = ends[index] as number;
      // Each definition ends after its last line ending; count the lines it spans.
      let lines = 0;
      for (let i = from; i < end; i++) if (paragraph.content.charCodeAt(i) === 0x0a) lines++;
      node.endLine = line + Math.max(1, lines) - 1;
      node.open = false;
      node.definition = definition;
      line += Math.max(1, lines);
      from = end;
      return node;
    });
    if (nodes.length > 0) paragraph.startLine = line;
    return { content: paragraph.content.slice(rest), definitions: nodes };
  }

  private finalize(block: BlockNode, line: number): void {
    const parent = block.parent;
    block.open = false;
    block.endLine = line;
    switch (block.kind) {
      case 'paragraph': {
        const found = this.extractDefinitions(block);
        if (found.definitions.length > 0 && parent) {
          parent.children.pop();
          parent.children.push(...found.definitions);
          if (!isBlankText(found.content)) {
            block.content = found.content;
            parent.children.push(block);
          }
        }
        break;
      }
      case 'code':
        if (block.fenced) {
          const newline = block.content.indexOf('\n');
          const first = newline < 0 ? block.content : block.content.slice(0, newline);
          block.info = first.trim();
          block.content = newline < 0 ? '' : block.content.slice(newline + 1);
        } else {
          const lines = block.content.split('\n');
          while (lines.length > 0 && /^[ \t]*$/.test(lines[lines.length - 1] as string))
            lines.pop();
          block.content = `${lines.join('\n')}\n`;
        }
        break;
      case 'html':
        block.content = block.content.replace(/\n$/, '');
        break;
      case 'item': {
        const last = lastChild(block);
        block.endLine = last ? last.endLine : block.startLine;
        break;
      }
      case 'list': {
        const lastItem = lastChild(block);
        if (lastItem) block.endLine = lastItem.endLine;
        block.tight = true;
        const endsWithBlank = (node: BlockNode, next: BlockNode | undefined) =>
          next !== undefined && node.endLine !== next.startLine - 1;
        outer: for (let i = 0; i < block.children.length; i++) {
          const item = block.children[i] as BlockNode;
          if (endsWithBlank(item, block.children[i + 1])) {
            block.tight = false;
            break;
          }
          for (let j = 0; j < item.children.length; j++) {
            if (endsWithBlank(item.children[j] as BlockNode, item.children[j + 1])) {
              block.tight = false;
              break outer;
            }
          }
        }
        break;
      }
      default:
        break;
    }
    this.tip = parent ?? this.doc;
  }
}
