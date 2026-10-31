/**
 * The PDF writer (ADR-016): an owned PDF 1.7 writer over the paged layout
 * of `@texuli/document/paged`. Text is set in the standard 14 fonts
 * (Helvetica and Courier, WinAnsi encoding) with their metrics; text
 * outside WinAnsi uses the host's TrueType font, embedded whole as a CID
 * font with a `ToUnicode` map, when one is given. Headings, paragraphs
 * with marks, lists, quotes, callouts, code, tables, columns, images (JPEG
 * and PNG), link annotations through the URL policy, explicit page
 * breaks, and headers and footers with page numbers. Every string the
 * file carries is written as a hex string, so content can never close a
 * string or inject an operator; there is no JavaScript, no form and no
 * embedded file. Output is deterministic: no dates, no random ids.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import { compressBytes } from '@texuli/core/zip';
import type {
  CalloutTone,
  DocumentBlock,
  DocumentInline,
  PageSettings,
  TexuliDocument,
} from '../model/types.ts';
import type { DocumentDesign } from '../output/design.ts';
import {
  embedText,
  fileLink,
  type ImageResolver,
  type LoadedImage,
  loadImage,
  type OutputDiagnostic,
  runLink,
  runStyle,
  wrappedTable,
  wrappedText,
} from '../output/shared.ts';
import { pageGeometry } from '../paged/geometry.ts';
import {
  type BlockMeasurer,
  documentPageSettings,
  layoutDocument,
  type PagedLayout,
} from '../paged/layout.ts';
import type { PageSlice } from '../paged/paginate.ts';
import {
  HELVETICA_FAMILY,
  type StandardFamily,
  type StandardFont,
  standardFont,
  winAnsiCode,
} from './fonts.ts';
import { type PdfImage, pdfImage } from './images.ts';
import { parseTrueType, type TrueTypeFont } from './truetype.ts';

export const PDF_MIME = 'application/pdf';

export interface PdfOptions {
  /** Override the document's page settings. */
  page?: Partial<PageSettings>;
  /** Image bytes for media blocks (PNG or JPEG); without it images print their alt text. */
  resolveImage?: ImageResolver;
  /** URL tier for links and image refs (default `untrusted`). */
  trust?: HrefTrust;
  /** An absolute URL for a nested page, so page links get a link annotation (through the URL policy). */
  pageHref?: (ref: string) => string | null | undefined;
  /** When the settings have no footer, number the pages. Default true. */
  pageNumbers?: boolean;
  /** A TrueType font (`.ttf` bytes) for text outside WinAnsi, embedded whole. */
  font?: Uint8Array;
  /** Body text size in points (default 11; 8 to 18). */
  fontSize?: number;
  /** Deflate the content streams where the platform can (default true). */
  compress?: boolean;
  /**
   * Design values (ADR-024): text, muted, link, rule, code and callout
   * colors, a page background when it is not white, and the body family
   * (a serif stack sets the text in Times, loaded on use; anything else
   * stays Helvetica). Default: none, and the output is unchanged.
   */
  design?: DocumentDesign | null;
}

export interface PdfResult {
  bytes: Uint8Array;
  pageCount: number;
  /** The paged layout the file was drawn from. */
  layout: PagedLayout;
  diagnostics: OutputDiagnostic[];
}

export type Rgb = readonly [number, number, number];
type FontRef = StandardFont | 'T1';

interface Frag {
  font: FontRef;
  size: number;
  color: Rgb;
  /** WinAnsi bytes (standard fonts) or glyph ids (the TrueType font). */
  codes: number[];
  width: number;
  x: number;
  link: string | null;
  underline: boolean;
}

interface TextItem {
  kind: 'text';
  top: number;
  bottom: number;
  baseline: number;
  frags: Frag[];
}
interface RectItem {
  kind: 'rect';
  top: number;
  bottom: number;
  x: number;
  width: number;
  color: Rgb;
}
interface ImageItem {
  kind: 'image';
  top: number;
  bottom: number;
  x: number;
  width: number;
  name: string;
}
type Item = TextItem | RectItem | ImageItem;

interface Box {
  height: number;
  lines: number[];
  items: Item[];
}

interface Style {
  strong?: boolean;
  em?: boolean;
  code?: boolean;
  color?: Rgb;
  size: number;
}

export interface Colors {
  ink: Rgb;
  muted: Rgb;
  link: Rgb;
  rule: Rgb;
  codeBg: Rgb;
  tones: Record<CalloutTone, { fill: Rgb; bar: Rgb }>;
  /** A page fill, only when the design's background is not white. */
  page: Rgb | null;
}

const TONES: Record<CalloutTone, { fill: Rgb; bar: Rgb }> = {
  neutral: { fill: [0.953, 0.957, 0.965], bar: [0.612, 0.639, 0.686] },
  accent: { fill: [0.933, 0.949, 1], bar: [0.31, 0.275, 0.898] },
  info: { fill: [0.91, 0.945, 0.992], bar: [0.145, 0.388, 0.922] },
  success: { fill: [0.91, 0.965, 0.933], bar: [0.086, 0.639, 0.29] },
  warning: { fill: [1, 0.965, 0.878], bar: [0.851, 0.467, 0.024] },
  danger: { fill: [0.992, 0.925, 0.925], bar: [0.863, 0.149, 0.149] },
};
const DEFAULT_COLORS: Colors = {
  ink: [0.13, 0.13, 0.15],
  muted: [0.36, 0.37, 0.4],
  link: [0.02, 0.36, 0.76],
  rule: [0.75, 0.76, 0.78],
  codeBg: [0.95, 0.95, 0.96],
  tones: TONES,
  page: null,
};

const HEADING_SCALE = [0, 2, 1.6, 1.3, 1.15];
const LINE = 1.45;
const GAP = 8;

const num = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};
const asciiHex = (value: string) => {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) continue;
    out += code.toString(16).padStart(2, '0');
  }
  return `<${out}>`;
};
/** A PDF text string: UTF-16BE with a byte order mark, hex-encoded. */
const textString = (value: string) => {
  let out = 'FEFF';
  for (let i = 0; i < value.length; i += 1)
    out += value.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${out.toUpperCase()}>`;
};

class Layout {
  readonly diagnostics: OutputDiagnostic[] = [];
  readonly glyphs = new Map<number, number>();
  readonly images = new Map<string, { name: string; image: PdfImage }>();
  private missing = false;
  readonly ttf: TrueTypeFont | null;
  readonly trust: HrefTrust;
  readonly base: number;
  readonly pageHref: ((ref: string) => string | null | undefined) | undefined;
  /** Images never outgrow a page: the content height caps them. */
  readonly maxImageHeight: number;
  readonly colors: Colors;
  readonly family: StandardFamily;

  constructor(
    ttf: TrueTypeFont | null,
    trust: HrefTrust,
    base: number,
    pageHref: ((ref: string) => string | null | undefined) | undefined,
    maxImageHeight: number,
    colors: Colors = DEFAULT_COLORS,
    family: StandardFamily = HELVETICA_FAMILY
  ) {
    this.colors = colors;
    this.family = family;
    this.ttf = ttf;
    this.trust = trust;
    this.base = base;
    this.pageHref = pageHref;
    this.maxImageHeight = maxImageHeight;
  }

  /** Split text into same-font fragments with widths. */
  shape(text: string, style: Style, link: string | null): Frag[] {
    const std = standardFont(style);
    const color = link ? this.colors.link : (style.color ?? this.colors.ink);
    const out: Frag[] = [];
    let current: Frag | null = null;
    for (const character of text) {
      const point = character.codePointAt(0) ?? 0x3f;
      let font: FontRef = std;
      let code = winAnsiCode(point);
      let width = 0;
      if (code < 0) {
        const glyph = this.ttf ? this.ttf.glyph(point) : 0;
        if (this.ttf && glyph > 0) {
          font = 'T1';
          code = glyph;
          if (!this.glyphs.has(glyph)) this.glyphs.set(glyph, point);
          width = (this.ttf.advance(glyph) * style.size) / 1000;
        } else {
          if (point === 0x09) code = 0x20;
          else {
            code = 0x3f;
            if (!this.missing) {
              this.missing = true;
              this.diagnostics.push({
                code: 'glyph-missing',
                message: this.ttf
                  ? 'Some characters are in neither WinAnsi nor the supplied font; they print as "?".'
                  : 'Some characters are outside WinAnsi; pass a TrueType `font` to print them. They print as "?".',
              });
            }
          }
        }
      }
      if (font !== 'T1')
        width = (this.family.width(font as StandardFont, code) * style.size) / 1000;
      if (!current || current.font !== font) {
        current = {
          font,
          size: style.size,
          color,
          codes: [],
          width: 0,
          x: 0,
          link,
          underline: link !== null,
        };
        out.push(current);
      }
      current.codes.push(code);
      current.width += width;
    }
    return out;
  }

  /** Greedy line breaking of styled runs at `width`. Linear in the text. */
  wrap(
    runs: readonly { text: string; style: Style; link: string | null }[],
    width: number
  ): Frag[][] {
    const lines: Frag[][] = [];
    let line: Frag[] = [];
    let used = 0;
    let space: Frag[] | null = null;
    const push = () => {
      lines.push(line);
      line = [];
      used = 0;
      space = null;
    };
    const place = (frags: Frag[]) => {
      for (const frag of frags) {
        frag.x = used;
        used += frag.width;
        line.push(frag);
      }
    };
    for (const run of runs) {
      if (run.text === '\n') {
        push();
        continue;
      }
      for (const match of run.text.matchAll(/\s+|\S+/g)) {
        const token = match[0];
        if (/^\s/.test(token)) {
          if (line.length > 0) space = this.shape(' ', run.style, run.link);
          continue;
        }
        const word = this.shape(token, run.style, run.link);
        const wordWidth = word.reduce((sum, frag) => sum + frag.width, 0);
        const spaceWidth = space ? (space as Frag[]).reduce((sum, frag) => sum + frag.width, 0) : 0;
        if (line.length > 0 && used + spaceWidth + wordWidth > width) push();
        if (line.length > 0 && space) place(space);
        space = null;
        if (wordWidth <= width - used) {
          place(word);
          continue;
        }
        // A word longer than the line: break it between characters.
        for (const character of token) {
          const piece = this.shape(character, run.style, run.link);
          const pieceWidth = piece.reduce((sum, frag) => sum + frag.width, 0);
          if (line.length > 0 && used + pieceWidth > width) push();
          place(piece);
        }
      }
    }
    if (line.length > 0 || lines.length === 0) push();
    return lines;
  }

  inlineRuns(
    content: readonly DocumentInline[],
    base: Style
  ): { text: string; style: Style; link: string | null }[] {
    const out: { text: string; style: Style; link: string | null }[] = [];
    for (const part of content) {
      if (part.type === 'break') {
        out.push({ text: '\n', style: base, link: null });
        continue;
      }
      const marks = runStyle(part);
      const href = runLink(part);
      let link: string | null = null;
      if (href !== null) {
        link = fileLink(href, this.trust);
        if (!link) {
          this.diagnostics.push({
            code: 'link-refused',
            message: 'A link is refused by the URL policy; its text is kept.',
          });
        }
      }
      out.push({
        text: part.text,
        style: {
          ...base,
          strong: base.strong || marks.strong,
          em: base.em || marks.em,
          code: marks.code,
          size: marks.code ? base.size * 0.92 : base.size,
        },
        link,
      });
    }
    return out;
  }

  /** Lay text lines at `y`, return the new y. */
  text(
    box: Box,
    runs: ReturnType<Layout['inlineRuns']>,
    x: number,
    y: number,
    width: number,
    size: number
  ): number {
    const lineHeight = size * LINE;
    for (const frags of this.wrap(runs, width)) {
      for (const frag of frags) frag.x += x;
      const top = y;
      const bottom = y + lineHeight;
      box.items.push({
        kind: 'text',
        top,
        bottom,
        baseline: top + (lineHeight - size) / 2 + size * 0.8,
        frags,
      });
      box.lines.push(bottom);
      y = bottom;
    }
    return y;
  }

  code(box: Box, value: string, x: number, y: number, width: number): number {
    const size = this.base * 0.85;
    const lineHeight = size * 1.35;
    const pad = 6;
    const start = y;
    const rect: RectItem = { kind: 'rect', top: y, bottom: y, x, width, color: this.colors.codeBg };
    box.items.push(rect);
    y += pad;
    const columns = Math.max(8, Math.floor((width - pad * 2) / (size * 0.6)));
    const style: Style = { code: true, size };
    for (const raw of value.replace(/\t/g, '    ').split('\n')) {
      const characters = Array.from(raw);
      let index = 0;
      do {
        const piece = characters.slice(index, index + columns).join('');
        index += columns;
        const frags = this.shape(piece, style, null);
        let at = x + pad;
        for (const frag of frags) {
          frag.x = at;
          at += frag.width;
        }
        box.items.push({
          kind: 'text',
          top: y,
          bottom: y + lineHeight,
          baseline: y + lineHeight * 0.78,
          frags,
        });
        y += lineHeight;
        box.lines.push(y);
      } while (index < characters.length);
    }
    y += pad;
    rect.bottom = y;
    if (box.lines.length > 0) box.lines[box.lines.length - 1] = y;
    return y > start ? y : start;
  }

  blocks(
    box: Box,
    blocks: readonly DocumentBlock[],
    x: number,
    y: number,
    width: number,
    depth: number
  ): number {
    blocks.forEach((block, index) => {
      if (index > 0) y += GAP * 0.75;
      y = this.block(box, block, x, y, width, depth);
    });
    return y;
  }

  block(
    box: Box,
    block: DocumentBlock,
    x: number,
    y: number,
    width: number,
    depth: number
  ): number {
    if (depth > 16) return y;
    const size = this.base;
    switch (block.type) {
      case 'paragraph':
        return this.text(box, this.inlineRuns(block.content, { size }), x, y, width, size);
      case 'heading': {
        const headingSize = size * (HEADING_SCALE[block.level] ?? 1);
        y += depth === 0 ? headingSize * 0.35 : 0;
        return this.text(
          box,
          this.inlineRuns(block.content, { size: headingSize, strong: true }),
          x,
          y,
          width,
          headingSize
        );
      }
      case 'code':
        return this.code(box, block.text, x, y, width);
      case 'list': {
        let n = Math.max(0, Math.floor(block.start ?? 1));
        const indent = size * 1.6;
        block.items.forEach((item, index) => {
          if (index > 0) y += 2;
          const marker =
            block.kind === 'ordered'
              ? `${n}.`
              : block.kind === 'todo'
                ? item.checked
                  ? '[x]'
                  : '[ ]'
                : '•';
          n += 1;
          const markerFrags = this.shape(marker, { size }, null);
          const markerWidth = markerFrags.reduce((sum, frag) => sum + frag.width, 0);
          let at = x + Math.max(0, indent - markerWidth - size * 0.4);
          for (const frag of markerFrags) {
            frag.x = at;
            at += frag.width;
          }
          const lineHeight = size * LINE;
          box.items.push({
            kind: 'text',
            top: y,
            bottom: y + lineHeight,
            baseline: y + (lineHeight - size) / 2 + size * 0.8,
            frags: markerFrags,
          });
          y = this.blocks(box, item.blocks, x + indent, y, width - indent, depth + 1);
        });
        return y;
      }
      case 'quote': {
        const top = y;
        const bar: RectItem = {
          kind: 'rect',
          top,
          bottom: top,
          x,
          width: 2.5,
          color: this.colors.rule,
        };
        box.items.push(bar);
        const before = box.items.length;
        y = this.blocks(box, block.blocks, x + 12, y, width - 12, depth + 1);
        for (const item of box.items.slice(before))
          if (item.kind === 'text')
            for (const frag of item.frags) if (!frag.link) frag.color = this.colors.muted;
        bar.bottom = y;
        return y;
      }
      case 'divider': {
        const middle = y + size * 0.6;
        box.items.push({
          kind: 'rect',
          top: middle,
          bottom: middle + 0.75,
          x,
          width,
          color: this.colors.rule,
        });
        return y + size * 1.2;
      }
      case 'media': {
        const loaded = this.images.get(block.id);
        if (!loaded) {
          return this.text(
            box,
            [
              {
                text: `[Image: ${block.alt || block.ref}]`,
                style: { size, em: true, color: this.colors.muted },
                link: null,
              },
            ],
            x,
            y,
            width,
            size
          );
        }
        let drawWidth = Math.min(width, loaded.image.width * 0.75);
        let drawHeight = (drawWidth * loaded.image.height) / loaded.image.width;
        if (drawHeight > this.maxImageHeight) {
          drawWidth = (drawWidth * this.maxImageHeight) / drawHeight;
          drawHeight = this.maxImageHeight;
        }
        box.items.push({
          kind: 'image',
          top: y,
          bottom: y + drawHeight,
          x,
          width: drawWidth,
          name: loaded.name,
        });
        return y + drawHeight;
      }
      case 'callout': {
        const tone = this.colors.tones[block.tone] ?? this.colors.tones.neutral;
        const pad = 8;
        const fill: RectItem = { kind: 'rect', top: y, bottom: y, x, width, color: tone.fill };
        const bar: RectItem = { kind: 'rect', top: y, bottom: y, x, width: 3, color: tone.bar };
        box.items.push(fill, bar);
        let inner = y + pad;
        if (block.title) {
          inner = this.text(
            box,
            [{ text: block.title, style: { size, strong: true }, link: null }],
            x + pad + 4,
            inner,
            width - pad * 2 - 4,
            size
          );
        }
        inner =
          this.blocks(box, block.blocks, x + pad + 4, inner, width - pad * 2 - 4, depth + 1) + pad;
        fill.bottom = inner;
        bar.bottom = inner;
        if (box.lines.length > 0) box.lines[box.lines.length - 1] = inner;
        return inner;
      }
      case 'toggle': {
        y = this.text(
          box,
          this.inlineRuns(block.summary, { size, strong: true }),
          x,
          y,
          width,
          size
        );
        return this.blocks(box, block.blocks, x + size, y, width - size, depth + 1);
      }
      case 'columns': {
        const gutter = 14;
        const total = block.columns.reduce(
          (sum, column) => sum + Math.max(1, column.width ?? 1),
          0
        );
        const usable = width - gutter * (block.columns.length - 1);
        let at = x;
        let bottom = y;
        const lines = box.lines.length;
        for (const column of block.columns) {
          const columnWidth = (usable * Math.max(1, column.width ?? 1)) / total;
          bottom = Math.max(bottom, this.blocks(box, column.blocks, at, y, columnWidth, depth + 1));
          at += columnWidth + gutter;
        }
        // Columns never split: drop the line breaks their text added.
        box.lines.length = lines;
        box.lines.push(bottom);
        return bottom;
      }
      case 'page-link': {
        const href = this.pageHref?.(block.ref);
        const link = href ? fileLink(href, this.trust) : null;
        return this.text(
          box,
          [{ text: block.title || block.ref, style: { size }, link }],
          x,
          y,
          width,
          size
        );
      }
      case 'block': {
        const table = wrappedTable(block);
        if (!table) {
          this.diagnostics.push({
            code: 'block-as-text',
            id: block.id,
            message: `A ${block.block} block is written as text.`,
          });
          return this.text(
            box,
            [{ text: wrappedText(block), style: { size }, link: null }],
            x,
            y,
            width,
            size
          );
        }
        const cellSize = size * 0.92;
        const pad = 4;
        if (table.caption) {
          y = this.text(
            box,
            [
              {
                text: table.caption,
                style: { size: cellSize, em: true, color: this.colors.muted },
                link: null,
              },
            ],
            x,
            y,
            width,
            cellSize
          );
        }
        const columnWidth = width / table.header.length;
        const row = (cells: string[], header: boolean) => {
          const top = y;
          let bottom = y;
          cells.forEach((value, index) => {
            const scratch: Box = { height: 0, lines: [], items: [] };
            const end = this.text(
              scratch,
              [{ text: value, style: { size: cellSize, strong: header }, link: null }],
              x + index * columnWidth + pad,
              top + pad,
              columnWidth - pad * 2,
              cellSize
            );
            box.items.push(...scratch.items);
            bottom = Math.max(bottom, end + pad);
          });
          box.items.push({
            kind: 'rect',
            top: bottom - (header ? 1 : 0.5),
            bottom,
            x,
            width,
            color: header ? this.colors.ink : this.colors.rule,
          });
          box.lines.push(bottom);
          y = bottom;
        };
        box.items.push({
          kind: 'rect',
          top: y,
          bottom: y + 0.5,
          x,
          width,
          color: this.colors.rule,
        });
        row(table.header, true);
        for (const cells of table.rows) row(cells, false);
        return y;
      }
      case 'embed':
        this.diagnostics.push({
          code: 'embed-as-text',
          id: block.id,
          message: `A ${block.kind} embed is written as text.`,
        });
        return this.text(
          box,
          [
            {
              text: embedText(block),
              style: { size, em: true, color: this.colors.muted },
              link: null,
            },
          ],
          x,
          y,
          width,
          size
        );
      default:
        return y;
    }
  }

  box(block: DocumentBlock, width: number): Box {
    const box: Box = { height: 0, lines: [], items: [] };
    box.height = this.block(box, block, 0, 0, width, 0);
    return box;
  }
}

class Objects {
  private readonly chunks: Uint8Array[] = [];
  private readonly offsets: number[] = [];
  private length = 0;
  private count = 0;
  private readonly encoder = new TextEncoder();

  reserve(): number {
    this.count += 1;
    this.offsets[this.count] = -1;
    return this.count;
  }

  private write(part: string | Uint8Array): void {
    const bytes = typeof part === 'string' ? this.encoder.encode(part) : part;
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  header(): void {
    this.write('%PDF-1.7\n');
    this.write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  }

  put(id: number, body: string): void {
    this.offsets[id] = this.length;
    this.write(`${id} 0 obj\n${body}\nendobj\n`);
  }

  stream(id: number, dict: string, data: Uint8Array): void {
    this.offsets[id] = this.length;
    this.write(`${id} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`);
    this.write(data);
    this.write('\nendstream\nendobj\n');
  }

  finish(root: number, info: number): Uint8Array {
    const start = this.length;
    let table = `xref\n0 ${this.count + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= this.count; id += 1) {
      const offset = this.offsets[id] ?? -1;
      if (offset < 0) throw new Error(`PDF object ${id} was reserved but never written.`);
      table += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    this.write(
      `${table}trailer\n<< /Size ${this.count + 1} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${start}\n%%EOF\n`
    );
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

function frag(f: Frag): string {
  let hexCodes = '';
  for (const code of f.codes) hexCodes += code.toString(16).padStart(f.font === 'T1' ? 4 : 2, '0');
  return `/${f.font} ${num(f.size)} Tf <${hexCodes}> Tj`;
}

/** Write a validated document as a PDF. */
export async function writePdf(doc: TexuliDocument, options: PdfOptions = {}): Promise<PdfResult> {
  const trust: HrefTrust = options.trust === 'developer' ? 'developer' : 'untrusted';
  const compress = options.compress !== false;
  const base =
    typeof options.fontSize === 'number' && Number.isFinite(options.fontSize)
      ? Math.min(18, Math.max(8, options.fontSize))
      : 11;
  const diagnostics: OutputDiagnostic[] = [];
  let ttf: TrueTypeFont | null = null;
  if (options.font) {
    ttf = parseTrueType(options.font);
    if (!ttf) {
      diagnostics.push({
        code: 'font-unsupported',
        message:
          'The font is not a TrueType font this writer can embed (CFF and collections are refused).',
      });
    }
  }

  // Images first: resolution is asynchronous, layout is not.
  const loaded = new Map<string, LoadedImage | null>();
  const stack: (readonly DocumentBlock[])[] = [doc.blocks];
  while (stack.length > 0) {
    for (const block of stack.pop() as readonly DocumentBlock[]) {
      if (block.type === 'media')
        loaded.set(block.id, await loadImage(block, options.resolveImage, trust, diagnostics));
      else if (block.type === 'list') for (const item of block.items) stack.push(item.blocks);
      else if (block.type === 'columns')
        for (const column of block.columns) stack.push(column.blocks);
      else if (block.type === 'quote' || block.type === 'callout' || block.type === 'toggle')
        stack.push(block.blocks);
    }
  }
  const settings = documentPageSettings(doc, options.page);
  // Design values load their resolver (and Times, for a serif stack) only when given.
  const styled = options.design
    ? await (await import('./design.ts')).pdfDesign(options.design, DEFAULT_COLORS)
    : null;
  const colors = styled?.colors ?? DEFAULT_COLORS;
  const family = styled?.family ?? HELVETICA_FAMILY;
  const layout = new Layout(
    ttf,
    trust,
    base,
    options.pageHref,
    pageGeometry(settings).contentHeight * 0.95,
    colors,
    family
  );
  let imageCount = 0;
  for (const [id, image] of loaded) {
    if (!image) continue;
    const result = await pdfImage(image, compress);
    if (!result.ok) {
      diagnostics.push({ code: 'image-unsupported', id, message: result.reason });
      continue;
    }
    imageCount += 1;
    layout.images.set(id, { name: `Im${imageCount}`, image: result.value });
  }

  const boxes = new Map<number, Box>();
  const measure: BlockMeasurer = (block, unit, contentWidth) => {
    const box = layout.box(block, contentWidth);
    boxes.set(unit.index, box);
    return { height: box.height, lines: unit.splittable ? box.lines : undefined };
  };
  const paged = layoutDocument(doc, measure, {
    page: settings,
    gap: GAP,
    pageNumbers: options.pageNumbers,
  });
  diagnostics.push(...layout.diagnostics);
  if (paged.truncated)
    diagnostics.push({
      code: 'truncated',
      message: 'The document is longer than the page cap; the rest is not written.',
    });

  const { geometry } = paged;
  const out = new Objects();
  out.header();
  const catalog = out.reserve();
  const pagesId = out.reserve();
  const info = out.reserve();
  const fontIds = new Map<FontRef, number>();
  for (const name of Object.keys(family.names) as StandardFont[]) fontIds.set(name, out.reserve());
  const ttfIds =
    ttf && layout.glyphs.size > 0
      ? {
          type0: out.reserve(),
          cid: out.reserve(),
          descriptor: out.reserve(),
          file: out.reserve(),
          unicode: out.reserve(),
        }
      : null;
  if (ttfIds) fontIds.set('T1', ttfIds.type0);
  const imageIds = new Map<string, number>();
  const imageObjects: { id: number; smask: number | null; image: PdfImage }[] = [];
  for (const { name, image } of layout.images.values()) {
    const id = out.reserve();
    const smask = image.smask ? out.reserve() : null;
    imageIds.set(name, id);
    imageObjects.push({ id, smask, image });
  }
  const resources = `<< /Font << ${[...fontIds].map(([name, id]) => `/${name} ${id} 0 R`).join(' ')} >>${
    imageIds.size > 0
      ? ` /XObject << ${[...imageIds].map(([name, id]) => `/${name} ${id} 0 R`).join(' ')} >>`
      : ''
  } >>`;

  const x0 = geometry.margins.inlineStart;
  const pageIds: number[] = [];
  const pageBodies: {
    page: number;
    content: number;
    annots: number[];
    stream: string;
    links: string[];
  }[] = [];
  for (const page of paged.pages) {
    const ops: string[] = [];
    const links: string[] = [];
    if (colors.page)
      ops.push(
        `${num(colors.page[0])} ${num(colors.page[1])} ${num(colors.page[2])} rg 0 0 ${num(geometry.width)} ${num(geometry.height)} re f`
      );
    const contentTop = geometry.height - geometry.margins.top;
    const drawText = (item: TextItem, dy: number) => {
      for (const f of item.frags) {
        const x = x0 + f.x;
        const y = contentTop - (item.baseline + dy);
        ops.push(
          `BT ${num(f.color[0])} ${num(f.color[1])} ${num(f.color[2])} rg 1 0 0 1 ${num(x)} ${num(y)} Tm ${frag(f)} ET`
        );
        if (f.link) {
          if (f.underline)
            ops.push(
              `${num(f.color[0])} ${num(f.color[1])} ${num(f.color[2])} rg ${num(x)} ${num(y - f.size * 0.12)} ${num(f.width)} ${num(Math.max(0.5, f.size * 0.05))} re f`
            );
          let uri = f.link;
          try {
            uri = new URL(f.link).href;
          } catch {
            // mailto: and other absolute schemes keep their text.
          }
          links.push(
            `<< /Type /Annot /Subtype /Link /Rect [${num(x)} ${num(y - f.size * 0.25)} ${num(x + f.width)} ${num(y + f.size * 0.85)}] /Border [0 0 0] /A << /Type /Action /S /URI /URI ${asciiHex(uri)} >> >>`
          );
        }
      }
    };
    const drawSlice = (slice: PageSlice) => {
      const box = boxes.get(slice.index);
      if (!box) return;
      // Block coordinate t maps to content offset slice.top + (t - slice.from).
      const dy = slice.top - slice.from;
      const clip = slice.clipped;
      if (clip) {
        const top = contentTop - slice.top;
        ops.push(
          `q ${num(x0 - 2)} ${num(top - (slice.to - slice.from))} ${num(geometry.contentWidth + 4)} ${num(slice.to - slice.from)} re W n`
        );
      }
      const epsilon = 0.01;
      for (const item of box.items) {
        if (item.kind === 'rect') {
          const top = Math.max(item.top, slice.from);
          const bottom = Math.min(item.bottom, slice.to);
          if (bottom - top <= 0) continue;
          ops.push(
            `${num(item.color[0])} ${num(item.color[1])} ${num(item.color[2])} rg ${num(x0 + item.x)} ${num(contentTop - (bottom + dy))} ${num(item.width)} ${num(bottom - top)} re f`
          );
          continue;
        }
        const inside = item.top >= slice.from - epsilon && item.bottom <= slice.to + epsilon;
        const crossing = item.bottom > slice.from && item.top < slice.to;
        if (!(inside || (clip && crossing))) continue;
        if (item.kind === 'text') drawText(item, dy);
        else {
          const height = item.bottom - item.top;
          ops.push(
            `q ${num(item.width)} 0 0 ${num(height)} ${num(x0 + item.x)} ${num(contentTop - (item.bottom + dy))} cm /${item.name} Do Q`
          );
        }
      }
      if (clip) ops.push('Q');
    };
    // Backgrounds before text: rects are drawn in item order, which puts fills first.
    for (const slice of page.slices) drawSlice(slice);
    const band = (
      value: { start: string; center: string; end: string } | null,
      baselineFromTop: number
    ) => {
      if (!value) return;
      const size = Math.max(7, base * 0.8);
      const style: Style = { size, color: colors.muted };
      const place = (textValue: string, align: 'start' | 'center' | 'end') => {
        if (!textValue) return;
        const frags = layout.shape(textValue, style, null);
        const width = frags.reduce((sum, f) => sum + f.width, 0);
        let x =
          align === 'start'
            ? 0
            : align === 'center'
              ? (geometry.contentWidth - width) / 2
              : geometry.contentWidth - width;
        for (const f of frags) {
          f.x = x;
          x += f.width;
        }
        drawText({ kind: 'text', top: 0, bottom: 0, baseline: baselineFromTop, frags }, 0);
      };
      place(value.start, 'start');
      place(value.center, 'center');
      place(value.end, 'end');
    };
    band(page.header, -geometry.margins.top / 2);
    band(page.footer, geometry.contentHeight + geometry.margins.bottom / 2);
    const pageId = out.reserve();
    const contentId = out.reserve();
    pageIds.push(pageId);
    pageBodies.push({
      page: pageId,
      content: contentId,
      annots: links.map(() => out.reserve()),
      stream: ops.join('\n'),
      links,
    });
  }

  out.put(
    catalog,
    `<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /DisplayDocTitle true >>${doc.meta.locale ? ` /Lang ${asciiHex(doc.meta.locale)}` : ''} >>`
  );
  out.put(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  );
  out.put(
    info,
    `<< /Title ${textString(doc.meta.title)} /Producer ${textString('Texuli')}${
      doc.meta.authors?.length ? ` /Author ${textString(doc.meta.authors.join('; '))}` : ''
    }${doc.meta.description ? ` /Subject ${textString(doc.meta.description)}` : ''} >>`
  );
  for (const [name, base14] of Object.entries(family.names)) {
    out.put(
      fontIds.get(name as StandardFont) as number,
      `<< /Type /Font /Subtype /Type1 /BaseFont /${base14} /Encoding /WinAnsiEncoding >>`
    );
  }
  if (ttf && ttfIds) {
    const used = [...layout.glyphs.keys()].sort((a, b) => a - b);
    const widths = used.map((glyph) => `${glyph} [${ttf.advance(glyph)}]`).join(' ');
    const name = 'TexuliEmbedded';
    out.put(
      ttfIds.type0,
      `<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${ttfIds.cid} 0 R] /ToUnicode ${ttfIds.unicode} 0 R >>`
    );
    out.put(
      ttfIds.cid,
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${ttfIds.descriptor} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`
    );
    out.put(
      ttfIds.descriptor,
      `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${ttf.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${ttf.ascent} /Descent ${ttf.descent} /CapHeight ${ttf.capHeight} /StemV 80 /FontFile2 ${ttfIds.file} 0 R >>`
    );
    const packedFont = compress ? await compressBytes(ttf.bytes, 'deflate') : null;
    out.stream(
      ttfIds.file,
      `/Length1 ${ttf.bytes.length}${packedFont ? ' /Filter /FlateDecode' : ''}`,
      packedFont ?? ttf.bytes
    );
    const lines: string[] = [];
    for (let i = 0; i < used.length; i += 100) {
      const chunk = used.slice(i, i + 100);
      lines.push(`${chunk.length} beginbfchar`);
      for (const glyph of chunk) {
        const point = layout.glyphs.get(glyph) as number;
        let utf16 = '';
        for (const unit of String.fromCodePoint(point)) {
          for (let k = 0; k < unit.length; k += 1)
            utf16 += unit.charCodeAt(k).toString(16).padStart(4, '0');
        }
        lines.push(`<${glyph.toString(16).padStart(4, '0')}> <${utf16}>`);
      }
      lines.push('endbfchar');
    }
    const cmap = [
      '/CIDInit /ProcSet findresource begin',
      '12 dict begin',
      'begincmap',
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
      '/CMapName /Adobe-Identity-UCS def',
      '/CMapType 2 def',
      '1 begincodespacerange',
      '<0000> <FFFF>',
      'endcodespacerange',
      ...lines,
      'endcmap',
      'CMapName currentdict /CMap defineresource pop',
      'end',
      'end',
    ].join('\n');
    out.stream(ttfIds.unicode, '', new TextEncoder().encode(cmap));
  }
  for (const { id, smask, image } of imageObjects) {
    out.stream(id, `${image.image.dict}${smask ? ` /SMask ${smask} 0 R` : ''}`, image.image.data);
    if (smask && image.smask) out.stream(smask, image.smask.dict, image.smask.data);
  }
  const encoder = new TextEncoder();
  for (const body of pageBodies) {
    out.put(
      body.page,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(geometry.width)} ${num(geometry.height)}] /Resources ${resources} /Contents ${body.content} 0 R${
        body.annots.length > 0 ? ` /Annots [${body.annots.map((id) => `${id} 0 R`).join(' ')}]` : ''
      } >>`
    );
    const raw = encoder.encode(body.stream);
    const packedStream = compress ? await compressBytes(raw, 'deflate') : null;
    out.stream(body.content, packedStream ? '/Filter /FlateDecode' : '', packedStream ?? raw);
    body.annots.forEach((id, index) => {
      out.put(id, body.links[index] as string);
    });
  }
  return {
    bytes: out.finish(catalog, info),
    pageCount: paged.pages.length,
    layout: paged,
    diagnostics,
  };
}
