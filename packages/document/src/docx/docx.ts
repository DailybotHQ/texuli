/**
 * The DOCX writer (ADR-016): WordprocessingML for a validated document, on
 * the escaped `@texuli/core/markup` builders and the `@texuli/core/zip`
 * writer. Headings, paragraphs with marks, lists (bullet, numbered, todo,
 * nested), quotes, callouts as shaded paragraphs, code, wrapped tables,
 * columns as a borderless table, images from host-resolved bytes, links
 * through the URL policy, explicit page breaks, headers and footers with
 * page fields, and the page size and margins. Annotations are dropped.
 * Sink-free by construction: every string enters as an escaped text or
 * attribute node, and no part is concatenated by hand.
 */
import { el, type MarkupChild, type MarkupElement, serializeXml } from '@texuli/core/markup';
import type { HrefTrust } from '@texuli/core/url-policy';
import { writeZipAsync, type ZipEntry } from '@texuli/core/zip';
import type {
  CalloutTone,
  DocumentBlock,
  DocumentInline,
  ListBlock,
  PageBand,
  PageSettings,
  TexuliDocument,
} from '../model/types.ts';
import type { DocumentDesign } from '../output/design.ts';
import {
  bandSegments,
  embedText,
  fileLink,
  type ImageResolver,
  type LoadedImage,
  loadImage,
  type OutputDiagnostic,
  runLink,
  runStyle,
  type SimpleTable,
  wrappedTable,
  wrappedText,
} from '../output/shared.ts';
import { MM, pageGeometry } from '../paged/geometry.ts';
import { DEFAULT_FOOTER, documentPageSettings } from '../paged/layout.ts';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface DocxOptions {
  /** Override the document's page settings. */
  page?: Partial<PageSettings>;
  /** Image bytes for media blocks (PNG or JPEG); without it images print their alt text. */
  resolveImage?: ImageResolver;
  /** URL tier for links and image refs (default `untrusted`). */
  trust?: HrefTrust;
  /** An absolute URL for a nested page, so page links become hyperlinks (through the URL policy). */
  pageHref?: (ref: string) => string | null | undefined;
  /** When the settings have no footer, number the pages. Default true. */
  pageNumbers?: boolean;
  /** Deflate the package where the platform can (default true). */
  compress?: boolean;
  /**
   * Design values (ADR-024): the body, heading and code families (the
   * first concrete family of each stack), the text, link, rule and code
   * colors, and the callout fills and bars. Default: none, and the output
   * is unchanged.
   */
  design?: DocumentDesign | null;
}

export interface DocxResult {
  bytes: Uint8Array;
  diagnostics: OutputDiagnostic[];
}

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  types: 'http://schemas.openxmlformats.org/package/2006/content-types',
};
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Element and attribute names the writer emits: its own vocabulary only. */
const ALLOWED_PREFIXES =
  /^(?:w|r|wp|a|pic|cp|dc|dcterms|xsi|xmlns|xml):|^(?:xmlns|Types|Default|Override|Extension|ContentType|PartName|Relationships|Relationship|Id|Type|Target|TargetMode|Properties|Application|uri|id|name|descr|noChangeAspect|cx|cy|x|y|prst|r:embed|distT|distB|distL|distR)$/;
const allow = (name: string) => ALLOWED_PREFIXES.test(name);
const xml = (root: MarkupElement) => serializeXml(root, { allow });

/** Twentieths of a point. */
const twips = (points: number) => Math.round(points * 20);
const EMU_PER_PT = 12_700;

const TONES: Record<CalloutTone, { fill: string; border: string }> = {
  neutral: { fill: 'F3F4F6', border: '9CA3AF' },
  accent: { fill: 'EEF2FF', border: '4F46E5' },
  info: { fill: 'E8F1FD', border: '2563EB' },
  success: { fill: 'E8F6EE', border: '16A34A' },
  warning: { fill: 'FFF6E0', border: 'D97706' },
  danger: { fill: 'FDECEC', border: 'DC2626' },
};

/** The fonts and colors a package is written with. */
export interface DocxTheme {
  body: string;
  /** A heading family, only when it differs from the body's. */
  heading: string | null;
  mono: string;
  /** The text color, only from a design. */
  text: string | null;
  link: string;
  rule: string;
  code: string;
  tones: Record<CalloutTone, { fill: string; border: string }>;
}

const DEFAULT_THEME: DocxTheme = {
  body: 'Calibri',
  heading: null,
  mono: 'Consolas',
  text: null,
  link: '0563C1',
  rule: 'BFBFBF',
  code: 'F2F2F2',
  tones: TONES,
};

const fonts = (name: string, eastAsia = false) =>
  el('w:rFonts', {
    'w:ascii': name,
    'w:hAnsi': name,
    'w:eastAsia': eastAsia ? name : undefined,
    'w:cs': name,
  });

interface ParagraphOptions {
  style?: string;
  keepNext?: boolean;
  numbering?: { id: number; level: number };
  shade?: { fill: string; border: string };
  borderBottom?: boolean;
  indent?: number;
  bidi?: boolean;
  tabs?: MarkupElement[];
  spacingAfter?: number;
}

interface Context {
  /** List nesting level. */
  level: number;
  /** Quote and callout indent, in twips. */
  indent: number;
  shade?: { fill: string; border: string };
  depth: number;
}

class Writer {
  readonly diagnostics: OutputDiagnostic[] = [];
  readonly rels: MarkupElement[] = [];
  readonly media: ZipEntry[] = [];
  readonly nums: MarkupElement[] = [];
  private nextRel = 1;
  private nextNum = 1;
  private nextPicture = 1;
  private pendingBreak = false;
  private readonly images = new Map<string, LoadedImage | null>();

  readonly doc: TexuliDocument;
  readonly trust: HrefTrust;
  readonly contentWidth: number;
  readonly rtl: boolean;
  readonly pageHref: ((ref: string) => string | null | undefined) | undefined;
  readonly theme: DocxTheme;

  constructor(
    doc: TexuliDocument,
    trust: HrefTrust,
    contentWidth: number,
    rtl: boolean,
    pageHref?: (ref: string) => string | null | undefined,
    theme: DocxTheme = DEFAULT_THEME
  ) {
    this.theme = theme;
    this.doc = doc;
    this.trust = trust;
    this.contentWidth = contentWidth;
    this.rtl = rtl;
    this.pageHref = pageHref;
  }

  rel(type: string, target: string, external = false): string {
    const id = `rId${this.nextRel}`;
    this.nextRel += 1;
    this.rels.push(
      el('Relationship', {
        Id: id,
        Type: `${REL}/${type}`,
        Target: target,
        TargetMode: external ? 'External' : undefined,
      })
    );
    return id;
  }

  async preload(
    blocks: readonly DocumentBlock[],
    resolve: ImageResolver | undefined
  ): Promise<void> {
    const stack: (readonly DocumentBlock[])[] = [blocks];
    while (stack.length > 0) {
      for (const block of stack.pop() as readonly DocumentBlock[]) {
        if (block.type === 'media' && !this.images.has(block.id)) {
          this.images.set(block.id, await loadImage(block, resolve, this.trust, this.diagnostics));
        } else if (block.type === 'list') for (const item of block.items) stack.push(item.blocks);
        else if (block.type === 'columns')
          for (const column of block.columns) stack.push(column.blocks);
        else if (block.type === 'quote' || block.type === 'callout' || block.type === 'toggle')
          stack.push(block.blocks);
      }
    }
  }

  breakNext(): void {
    this.pendingBreak = true;
  }

  paragraph(options: ParagraphOptions, ...runs: MarkupChild[]): MarkupElement {
    const shade = options.shade;
    const pageBreak = this.pendingBreak;
    this.pendingBreak = false;
    const pPr = el(
      'w:pPr',
      {},
      options.style ? el('w:pStyle', { 'w:val': options.style }) : null,
      options.keepNext ? el('w:keepNext') : null,
      pageBreak ? el('w:pageBreakBefore') : null,
      options.numbering
        ? el(
            'w:numPr',
            {},
            el('w:ilvl', { 'w:val': options.numbering.level }),
            el('w:numId', { 'w:val': options.numbering.id })
          )
        : null,
      shade || options.borderBottom
        ? el(
            'w:pBdr',
            {},
            shade
              ? el('w:left', {
                  'w:val': 'single',
                  'w:sz': 18,
                  'w:space': 8,
                  'w:color': shade.border,
                })
              : null,
            options.borderBottom
              ? el('w:bottom', {
                  'w:val': 'single',
                  'w:sz': 6,
                  'w:space': 1,
                  'w:color': this.theme.rule,
                })
              : null
          )
        : null,
      shade ? el('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': shade.fill }) : null,
      options.tabs && options.tabs.length > 0 ? el('w:tabs', {}, options.tabs) : null,
      (options.bidi ?? this.rtl) ? el('w:bidi') : null,
      options.spacingAfter !== undefined
        ? el('w:spacing', { 'w:after': options.spacingAfter })
        : null,
      options.indent ? el('w:ind', { 'w:start': options.indent }) : null
    );
    return el('w:p', {}, pPr.children.length > 0 ? pPr : null, ...runs);
  }

  run(
    value: string,
    style: { strong?: boolean; em?: boolean; strike?: boolean; code?: boolean; link?: boolean } = {}
  ): MarkupElement {
    const rPr = el(
      'w:rPr',
      {},
      style.link ? el('w:rStyle', { 'w:val': 'Hyperlink' }) : null,
      style.code ? fonts(this.theme.mono) : null,
      style.strong ? el('w:b') : null,
      style.em ? el('w:i') : null,
      style.strike ? el('w:strike') : null,
      style.code
        ? el('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': this.theme.code })
        : null
    );
    const pieces: MarkupElement[] = [];
    // Newlines become breaks and tabs become tab characters.
    const lines = value.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) pieces.push(el('w:br'));
      const tabs = line.split('\t');
      tabs.forEach((piece, tab) => {
        if (tab > 0) pieces.push(el('w:tab'));
        if (piece) pieces.push(el('w:t', { 'xml:space': 'preserve' }, piece));
      });
    });
    return el('w:r', {}, rPr.children.length > 0 ? rPr : null, pieces);
  }

  inline(
    content: readonly DocumentInline[],
    base: { strong?: boolean; em?: boolean } = {}
  ): MarkupElement[] {
    const out: MarkupElement[] = [];
    let link: { href: string; runs: MarkupElement[] } | null = null;
    const close = () => {
      if (!link) return;
      const target = fileLink(link.href, this.trust);
      if (target) {
        out.push(
          el(
            'w:hyperlink',
            { 'r:id': this.rel('hyperlink', target, true), 'w:history': 1 },
            link.runs
          )
        );
      } else {
        this.diagnostics.push({
          code: 'link-refused',
          message: 'A link is refused by the URL policy; its text is kept.',
        });
        out.push(...link.runs);
      }
      link = null;
    };
    for (const part of content) {
      if (part.type === 'break') {
        const breakRun = el('w:r', {}, el('w:br'));
        if (link) link.runs.push(breakRun);
        else out.push(breakRun);
        continue;
      }
      const href = runLink(part);
      const style = runStyle(part);
      const node = this.run(part.text, {
        strong: style.strong || base.strong,
        em: style.em || base.em,
        strike: style.strike,
        code: style.code,
        link: href !== null,
      });
      if (href !== null) {
        if (link && link.href !== href) close();
        if (!link) link = { href, runs: [] };
        link.runs.push(node);
      } else {
        close();
        out.push(node);
      }
    }
    close();
    return out;
  }

  /** A fresh numbering instance, so every list restarts (at its `start` when ordered). */
  numbering(list: ListBlock): number {
    const id = this.nextNum;
    this.nextNum += 1;
    const ordered = list.kind === 'ordered';
    this.nums.push(
      el(
        'w:num',
        { 'w:numId': id },
        el('w:abstractNumId', { 'w:val': ordered ? 1 : list.kind === 'todo' ? 2 : 0 }),
        ordered
          ? el(
              'w:lvlOverride',
              { 'w:ilvl': 0 },
              el('w:startOverride', { 'w:val': Math.max(0, Math.floor(list.start ?? 1)) })
            )
          : null
      )
    );
    return id;
  }

  blocks(blocks: readonly DocumentBlock[], context: Context, top = false): MarkupElement[] {
    const out: MarkupElement[] = [];
    const breaks = top ? new Set(this.doc.page?.breaks ?? []) : null;
    blocks.forEach((block, index) => {
      if (breaks && index > 0 && breaks.has(block.id)) this.breakNext();
      out.push(...this.block(block, context));
    });
    return out;
  }

  private shaded(context: Context): ParagraphOptions {
    return { shade: context.shade, indent: context.indent || undefined };
  }

  block(block: DocumentBlock, context: Context): MarkupElement[] {
    if (context.depth > 16) return [];
    const inner = { ...context, depth: context.depth + 1 };
    switch (block.type) {
      case 'paragraph':
        return [this.paragraph(this.shaded(context), ...this.inline(block.content))];
      case 'heading':
        return [
          this.paragraph(
            { ...this.shaded(context), style: `Heading${block.level}`, keepNext: true },
            ...this.inline(block.content)
          ),
        ];
      case 'code':
        return [
          this.paragraph(
            { ...this.shaded(context), style: 'Code' },
            this.run(block.text, { code: true })
          ),
        ];
      case 'list': {
        const id = this.numbering(block);
        const out: MarkupElement[] = [];
        for (const item of block.items) {
          const [first, ...rest] = item.blocks;
          const prefix = block.kind === 'todo' ? this.run(item.checked ? '☑ ' : '☐ ') : null;
          if (first && first.type === 'paragraph') {
            out.push(
              this.paragraph(
                {
                  ...this.shaded(context),
                  style: 'ListParagraph',
                  numbering: { id, level: Math.min(8, context.level) },
                },
                prefix,
                ...this.inline(first.content)
              )
            );
          } else if (first) out.push(...this.block(first, inner));
          const nested = { ...inner, level: context.level + 1, indent: context.indent };
          for (const child of rest) {
            if (child.type === 'list') out.push(...this.block(child, nested));
            else
              out.push(
                ...this.block(child, {
                  ...inner,
                  indent: context.indent + 720 * (context.level + 1),
                })
              );
          }
        }
        return out;
      }
      case 'quote':
        return this.blocks(block.blocks, { ...inner, indent: context.indent + 567 });
      case 'divider':
        return [this.paragraph({ borderBottom: true })];
      case 'media': {
        const image = this.images.get(block.id);
        if (!image) {
          return [
            this.paragraph(
              this.shaded(context),
              this.run(`[Image: ${block.alt || block.ref}]`, { em: true })
            ),
          ];
        }
        return [this.paragraph(this.shaded(context), this.picture(image, block.alt))];
      }
      case 'callout': {
        const shade = this.theme.tones[block.tone] ?? this.theme.tones.neutral;
        const shadedContext = { ...inner, shade };
        const title = block.title
          ? [
              this.paragraph(
                { shade, indent: context.indent || undefined },
                this.run(block.title, { strong: true })
              ),
            ]
          : [];
        return [...title, ...this.blocks(block.blocks, shadedContext)];
      }
      case 'toggle':
        return [
          this.paragraph(
            { ...this.shaded(context), keepNext: true },
            ...this.inline(block.summary, { strong: true })
          ),
          ...this.blocks(block.blocks, inner),
        ];
      case 'columns':
        return this.columns(
          block.columns.map((column) => ({ width: column.width ?? 1, blocks: column.blocks })),
          inner
        );
      case 'page-link': {
        const href = this.pageHref?.(block.ref);
        const content: DocumentInline[] = [
          {
            type: 'text',
            text: block.title || block.ref,
            marks: href ? [{ type: 'link', href }] : [],
          },
        ];
        return [this.paragraph(this.shaded(context), ...this.inline(content))];
      }
      case 'block': {
        const table = wrappedTable(block);
        if (table) return this.table(table);
        this.diagnostics.push({
          code: 'block-as-text',
          id: block.id,
          message: `A ${block.block} block is written as text.`,
        });
        return [this.paragraph(this.shaded(context), this.run(wrappedText(block)))];
      }
      case 'embed':
        this.diagnostics.push({
          code: 'embed-as-text',
          id: block.id,
          message: `A ${block.kind} embed is written as text.`,
        });
        return [this.paragraph(this.shaded(context), this.run(embedText(block), { em: true }))];
      default:
        return [];
    }
  }

  private beforeTable(): MarkupElement[] {
    if (!this.pendingBreak) return [];
    return [this.paragraph({ spacingAfter: 0 })];
  }

  columns(
    columns: { width: number; blocks: readonly DocumentBlock[] }[],
    context: Context
  ): MarkupElement[] {
    const total = columns.reduce((sum, column) => sum + Math.max(1, column.width), 0);
    const widths = columns.map((column) =>
      Math.floor((twips(this.contentWidth) * Math.max(1, column.width)) / total)
    );
    const none = (side: string) => el(`w:${side}`, { 'w:val': 'nil' });
    return [
      ...this.beforeTable(),
      el(
        'w:tbl',
        {},
        el(
          'w:tblPr',
          {},
          el('w:tblW', { 'w:w': 5000, 'w:type': 'pct' }),
          el(
            'w:tblBorders',
            {},
            ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(none)
          ),
          el('w:tblLayout', { 'w:type': 'fixed' }),
          el('w:tblLook', { 'w:val': '0000' })
        ),
        el(
          'w:tblGrid',
          {},
          widths.map((width) => el('w:gridCol', { 'w:w': width }))
        ),
        el(
          'w:tr',
          {},
          columns.map((column, index) => {
            const body = this.blocks(column.blocks, { ...context, level: 0, indent: 0 });
            return el(
              'w:tc',
              {},
              el('w:tcPr', {}, el('w:tcW', { 'w:w': widths[index] as number, 'w:type': 'dxa' })),
              body,
              // A cell ends with a paragraph.
              body.at(-1)?.name === 'w:p' ? null : this.paragraph({})
            );
          })
        )
      ),
    ];
  }

  table(table: SimpleTable): MarkupElement[] {
    const columns = table.header.length;
    const width = Math.floor(twips(this.contentWidth) / columns);
    const row = (cells: string[], header: boolean) =>
      el(
        'w:tr',
        {},
        header ? el('w:trPr', {}, el('w:tblHeader')) : null,
        cells.map((value) =>
          el(
            'w:tc',
            {},
            el('w:tcPr', {}, el('w:tcW', { 'w:w': width, 'w:type': 'dxa' })),
            this.paragraph({ spacingAfter: 0 }, this.run(value, { strong: header }))
          )
        )
      );
    return [
      ...(table.caption
        ? [this.paragraph({ style: 'Caption', keepNext: true }, this.run(table.caption))]
        : this.beforeTable()),
      el(
        'w:tbl',
        {},
        el(
          'w:tblPr',
          {},
          el('w:tblStyle', { 'w:val': 'TableGrid' }),
          el('w:tblW', { 'w:w': 5000, 'w:type': 'pct' }),
          el('w:tblLook', {
            'w:val': '04A0',
            'w:firstRow': 1,
            'w:lastRow': 0,
            'w:firstColumn': 0,
            'w:lastColumn': 0,
            'w:noHBand': 0,
            'w:noVBand': 1,
          })
        ),
        el(
          'w:tblGrid',
          {},
          table.header.map(() => el('w:gridCol', { 'w:w': width }))
        ),
        row(table.header, true),
        table.rows.map((cells) => row(cells, false))
      ),
    ];
  }

  picture(image: LoadedImage, alt: string): MarkupElement {
    const id = this.nextPicture;
    this.nextPicture += 1;
    const extension = image.info.format === 'png' ? 'png' : 'jpeg';
    const name = `image${id}.${extension}`;
    this.media.push({ path: `word/media/${name}`, data: image.bytes, compress: false });
    const rel = this.rel('image', `media/${name}`);
    // Natural size at 96 dpi, scaled down to the content width.
    let widthPt = image.info.width * 0.75;
    let heightPt = image.info.height * 0.75;
    if (widthPt > this.contentWidth) {
      heightPt = (heightPt * this.contentWidth) / widthPt;
      widthPt = this.contentWidth;
    }
    const cx = Math.round(widthPt * EMU_PER_PT);
    const cy = Math.round(heightPt * EMU_PER_PT);
    return el(
      'w:r',
      {},
      el(
        'w:drawing',
        {},
        el(
          'wp:inline',
          { distT: 0, distB: 0, distL: 0, distR: 0 },
          el('wp:extent', { cx, cy }),
          el('wp:docPr', { id, name: `Picture ${id}`, descr: alt }),
          el('wp:cNvGraphicFramePr', {}, el('a:graphicFrameLocks', { noChangeAspect: 1 })),
          el(
            'a:graphic',
            {},
            el(
              'a:graphicData',
              { uri: 'http://schemas.openxmlformats.org/drawingml/2006/picture' },
              el(
                'pic:pic',
                {},
                el(
                  'pic:nvPicPr',
                  {},
                  el('pic:cNvPr', { id: 0, name, descr: alt }),
                  el('pic:cNvPicPr')
                ),
                el(
                  'pic:blipFill',
                  {},
                  el('a:blip', { 'r:embed': rel }),
                  el('a:stretch', {}, el('a:fillRect'))
                ),
                el(
                  'pic:spPr',
                  {},
                  el('a:xfrm', {}, el('a:off', { x: 0, y: 0 }), el('a:ext', { cx, cy })),
                  el('a:prstGeom', { prst: 'rect' }, el('a:avLst'))
                )
              )
            )
          )
        )
      )
    );
  }

  band(value: PageBand | undefined, tag: 'w:hdr' | 'w:ftr'): string {
    const title = this.doc.meta.title;
    const segments = (template: string | undefined) =>
      bandSegments(template, title).map((segment) =>
        'field' in segment
          ? el(
              'w:fldSimple',
              { 'w:instr': segment.field === 'page' ? ' PAGE ' : ' NUMPAGES ' },
              this.run('1')
            )
          : this.run(segment.text)
      );
    const tabRun = () => el('w:r', {}, el('w:tab'));
    const width = twips(this.contentWidth);
    const paragraph = this.paragraph(
      {
        style: tag === 'w:hdr' ? 'Header' : 'Footer',
        tabs: [
          el('w:tab', { 'w:val': 'center', 'w:pos': Math.round(width / 2) }),
          el('w:tab', { 'w:val': this.rtl ? 'left' : 'right', 'w:pos': width }),
        ],
      },
      segments(value?.start),
      tabRun(),
      segments(value?.center),
      tabRun(),
      segments(value?.end)
    );
    return xml(el(tag, { 'xmlns:w': NS.w, 'xmlns:r': NS.r }, paragraph));
  }
}

function stylesXml(locale: string | undefined, theme: DocxTheme = DEFAULT_THEME): string {
  const heading = (level: number, size: number) =>
    el(
      'w:style',
      { 'w:type': 'paragraph', 'w:styleId': `Heading${level}` },
      el('w:name', { 'w:val': `heading ${level}` }),
      el('w:basedOn', { 'w:val': 'Normal' }),
      el('w:next', { 'w:val': 'Normal' }),
      el('w:uiPriority', { 'w:val': 9 }),
      el('w:qFormat'),
      el(
        'w:pPr',
        {},
        el('w:keepNext'),
        el('w:keepLines'),
        el('w:spacing', { 'w:before': level === 1 ? 360 : 240, 'w:after': 120 }),
        el('w:outlineLvl', { 'w:val': level - 1 })
      ),
      el(
        'w:rPr',
        {},
        theme.heading ? fonts(theme.heading, true) : null,
        el('w:b'),
        el('w:sz', { 'w:val': size }),
        el('w:szCs', { 'w:val': size })
      )
    );
  const paragraphStyle = (id: string, name: string, pPr: MarkupChild, rPr: MarkupChild) =>
    el(
      'w:style',
      { 'w:type': 'paragraph', 'w:styleId': id },
      el('w:name', { 'w:val': name }),
      el('w:basedOn', { 'w:val': 'Normal' }),
      el('w:qFormat'),
      pPr ? el('w:pPr', {}, pPr) : null,
      rPr ? el('w:rPr', {}, rPr) : null
    );
  return xml(
    el(
      'w:styles',
      { 'xmlns:w': NS.w },
      el(
        'w:docDefaults',
        {},
        el(
          'w:rPrDefault',
          {},
          el(
            'w:rPr',
            {},
            fonts(theme.body, true),
            theme.text ? el('w:color', { 'w:val': theme.text }) : null,
            el('w:sz', { 'w:val': 22 }),
            el('w:szCs', { 'w:val': 22 }),
            el('w:lang', { 'w:val': locale || 'en-US' })
          )
        ),
        el(
          'w:pPrDefault',
          {},
          el('w:pPr', {}, el('w:spacing', { 'w:after': 120, 'w:line': 276, 'w:lineRule': 'auto' }))
        )
      ),
      el(
        'w:style',
        { 'w:type': 'paragraph', 'w:default': 1, 'w:styleId': 'Normal' },
        el('w:name', { 'w:val': 'Normal' }),
        el('w:qFormat')
      ),
      heading(1, 36),
      heading(2, 30),
      heading(3, 26),
      heading(4, 24),
      paragraphStyle(
        'Code',
        'Code',
        [
          el('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': theme.code }),
          el('w:spacing', { 'w:after': 120, 'w:line': 240, 'w:lineRule': 'auto' }),
        ],
        [fonts(theme.mono), el('w:sz', { 'w:val': 20 })]
      ),
      paragraphStyle('ListParagraph', 'List Paragraph', el('w:spacing', { 'w:after': 60 }), null),
      paragraphStyle('Caption', 'caption', el('w:spacing', { 'w:after': 60 }), [
        el('w:i'),
        el('w:sz', { 'w:val': 18 }),
      ]),
      paragraphStyle(
        'Header',
        'header',
        el('w:spacing', { 'w:after': 0 }),
        el('w:sz', { 'w:val': 18 })
      ),
      paragraphStyle(
        'Footer',
        'footer',
        el('w:spacing', { 'w:after': 0 }),
        el('w:sz', { 'w:val': 18 })
      ),
      el(
        'w:style',
        { 'w:type': 'character', 'w:styleId': 'Hyperlink' },
        el('w:name', { 'w:val': 'Hyperlink' }),
        el('w:rPr', {}, el('w:color', { 'w:val': theme.link }), el('w:u', { 'w:val': 'single' }))
      ),
      el(
        'w:style',
        { 'w:type': 'table', 'w:styleId': 'TableGrid' },
        el('w:name', { 'w:val': 'Table Grid' }),
        el(
          'w:tblPr',
          {},
          el(
            'w:tblBorders',
            {},
            ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) =>
              el(`w:${side}`, { 'w:val': 'single', 'w:sz': 4, 'w:space': 0, 'w:color': theme.rule })
            )
          ),
          el(
            'w:tblCellMar',
            {},
            el('w:left', { 'w:w': 108, 'w:type': 'dxa' }),
            el('w:right', { 'w:w': 108, 'w:type': 'dxa' })
          )
        )
      )
    )
  );
}

function numberingXml(nums: readonly MarkupElement[]): string {
  const BULLETS = ['•', '◦', '▪'];
  const abstract = (id: number, kind: 'bullet' | 'ordered' | 'todo') =>
    el(
      'w:abstractNum',
      { 'w:abstractNumId': id },
      el('w:multiLevelType', { 'w:val': 'hybridMultilevel' }),
      Array.from({ length: 9 }, (_, level) =>
        el(
          'w:lvl',
          { 'w:ilvl': level },
          el('w:start', { 'w:val': 1 }),
          el('w:numFmt', {
            'w:val':
              kind === 'ordered'
                ? (['decimal', 'lowerLetter', 'lowerRoman'][level % 3] as string)
                : kind === 'todo'
                  ? 'none'
                  : 'bullet',
          }),
          el('w:lvlText', {
            'w:val':
              kind === 'ordered'
                ? `%${level + 1}.`
                : kind === 'todo'
                  ? ''
                  : (BULLETS[level % 3] as string),
          }),
          el('w:lvlJc', { 'w:val': 'start' }),
          el('w:pPr', {}, el('w:ind', { 'w:start': 720 * (level + 1), 'w:hanging': 360 }))
        )
      )
    );
  return xml(
    el(
      'w:numbering',
      { 'xmlns:w': NS.w },
      abstract(0, 'bullet'),
      abstract(1, 'ordered'),
      abstract(2, 'todo'),
      nums
    )
  );
}

/** Write a validated document as a DOCX package. */
export async function writeDocx(
  doc: TexuliDocument,
  options: DocxOptions = {}
): Promise<DocxResult> {
  const settings = documentPageSettings(doc, options.page);
  const geometry = pageGeometry(settings);
  const rtl = doc.meta.dir === 'rtl';
  const trust: HrefTrust = options.trust === 'developer' ? 'developer' : 'untrusted';
  // Design values load their resolver only when given.
  const theme = options.design
    ? (await import('./design.ts')).docxDesign(options.design, DEFAULT_THEME)
    : DEFAULT_THEME;
  const writer = new Writer(doc, trust, geometry.contentWidth, rtl, options.pageHref, theme);
  await writer.preload(doc.blocks, options.resolveImage);

  writer.rel('styles', 'styles.xml');
  writer.rel('numbering', 'numbering.xml');
  const footerBand =
    settings.footer ?? (options.pageNumbers === false ? undefined : DEFAULT_FOOTER);
  const headerRel = settings.header ? writer.rel('header', 'header1.xml') : null;
  const footerRel = footerBand ? writer.rel('footer', 'footer1.xml') : null;

  const body = writer.blocks(doc.blocks, { level: 0, indent: 0, depth: 0 }, true);
  if (body.length === 0 || body.at(-1)?.name !== 'w:p') body.push(writer.paragraph({}));
  const margins = geometry.margins;
  const left = rtl ? margins.inlineEnd : margins.inlineStart;
  const right = rtl ? margins.inlineStart : margins.inlineEnd;
  const sectPr = el(
    'w:sectPr',
    {},
    headerRel ? el('w:headerReference', { 'w:type': 'default', 'r:id': headerRel }) : null,
    footerRel ? el('w:footerReference', { 'w:type': 'default', 'r:id': footerRel }) : null,
    el('w:pgSz', {
      'w:w': twips(geometry.width),
      'w:h': twips(geometry.height),
      'w:orient': geometry.orientation === 'landscape' ? 'landscape' : undefined,
    }),
    el('w:pgMar', {
      'w:top': twips(margins.top),
      'w:right': twips(right),
      'w:bottom': twips(margins.bottom),
      'w:left': twips(left),
      'w:header': twips(Math.max(margins.top / 2, 6 * MM)),
      'w:footer': twips(Math.max(margins.bottom / 2, 6 * MM)),
      'w:gutter': 0,
    }),
    rtl ? el('w:bidi') : null
  );
  const documentXml = xml(
    el(
      'w:document',
      { 'xmlns:w': NS.w, 'xmlns:r': NS.r, 'xmlns:wp': NS.wp, 'xmlns:a': NS.a, 'xmlns:pic': NS.pic },
      el('w:body', {}, body, sectPr)
    )
  );

  const meta = doc.meta;
  const coreXml = xml(
    el(
      'cp:coreProperties',
      {
        'xmlns:cp': 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:dcterms': 'http://purl.org/dc/terms/',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      },
      el('dc:title', {}, meta.title),
      meta.description ? el('dc:description', {}, meta.description) : null,
      meta.authors?.length ? el('dc:creator', {}, meta.authors.join('; ')) : null,
      meta.locale ? el('dc:language', {}, meta.locale) : null,
      meta.created ? el('dcterms:created', { 'xsi:type': 'dcterms:W3CDTF' }, meta.created) : null,
      meta.updated ? el('dcterms:modified', { 'xsi:type': 'dcterms:W3CDTF' }, meta.updated) : null
    )
  );
  const override = (part: string, type: string) =>
    el('Override', { PartName: part, ContentType: `application/vnd.openxmlformats-${type}` });
  const contentTypes = xml(
    el(
      'Types',
      { xmlns: NS.types },
      el('Default', {
        Extension: 'rels',
        ContentType: 'application/vnd.openxmlformats-package.relationships+xml',
      }),
      el('Default', { Extension: 'xml', ContentType: 'application/xml' }),
      el('Default', { Extension: 'png', ContentType: 'image/png' }),
      el('Default', { Extension: 'jpeg', ContentType: 'image/jpeg' }),
      override('/word/document.xml', 'officedocument.wordprocessingml.document.main+xml'),
      override('/word/styles.xml', 'officedocument.wordprocessingml.styles+xml'),
      override('/word/numbering.xml', 'officedocument.wordprocessingml.numbering+xml'),
      headerRel
        ? override('/word/header1.xml', 'officedocument.wordprocessingml.header+xml')
        : null,
      footerRel
        ? override('/word/footer1.xml', 'officedocument.wordprocessingml.footer+xml')
        : null,
      override('/docProps/core.xml', 'package.core-properties+xml'),
      override('/docProps/app.xml', 'officedocument.extended-properties+xml')
    )
  );
  const packageRels = xml(
    el(
      'Relationships',
      { xmlns: NS.rel },
      el('Relationship', {
        Id: 'rId1',
        Type: `${REL}/officeDocument`,
        Target: 'word/document.xml',
      }),
      el('Relationship', {
        Id: 'rId2',
        Type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
        Target: 'docProps/core.xml',
      }),
      el('Relationship', {
        Id: 'rId3',
        Type: `${REL}/extended-properties`,
        Target: 'docProps/app.xml',
      })
    )
  );
  const appXml = xml(
    el(
      'Properties',
      { xmlns: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties' },
      el('Application', {}, 'Texuli')
    )
  );
  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: contentTypes },
    { path: '_rels/.rels', data: packageRels },
    { path: 'docProps/core.xml', data: coreXml },
    { path: 'docProps/app.xml', data: appXml },
    { path: 'word/document.xml', data: documentXml },
    { path: 'word/styles.xml', data: stylesXml(meta.locale, theme) },
    { path: 'word/numbering.xml', data: numberingXml(writer.nums) },
    {
      path: 'word/_rels/document.xml.rels',
      data: xml(el('Relationships', { xmlns: NS.rel }, writer.rels)),
    },
  ];
  if (headerRel)
    entries.push({ path: 'word/header1.xml', data: writer.band(settings.header, 'w:hdr') });
  if (footerRel) entries.push({ path: 'word/footer1.xml', data: writer.band(footerBand, 'w:ftr') });
  entries.push(...writer.media);
  const bytes = await writeZipAsync(entries, { compress: options.compress !== false });
  return { bytes, diagnostics: writer.diagnostics };
}
