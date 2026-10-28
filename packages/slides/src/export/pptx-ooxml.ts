/**
 * PresentationML and DrawingML building blocks for the v2 PPTX writer: text
 * bodies with runs, positioned shapes, placeholders, pictures, native
 * tables, slide backgrounds and the theme. Geometry is in canvas pixels (the
 * deck's virtual canvas, 1280 × 720 for 16:9) and converts to EMU here, so
 * one pixel is 1/96 inch and the slide is exactly the print page.
 *
 * Every string reaches XML through `el` (escaped, control characters
 * dropped); colors and sizes are computed numbers or `#rrggbb` checked here.
 */
import { el, type XmlElement } from './xml.ts';

export const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
  types: 'http://schemas.openxmlformats.org/package/2006/content-types',
} as const;

export const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const PML = 'application/vnd.openxmlformats-officedocument.presentationml';

/** EMU per canvas pixel (914400 EMU per inch, 96 pixels per inch). */
export const EMU_PER_PX = 9525;

export const emu = (px: number): number => Math.max(0, Math.round(px * EMU_PER_PX));
/** Font size in hundredths of a point from canvas pixels (1px = 0.75pt), within OOXML's 1..4000pt. */
export const fontSize = (px: number): number =>
  Math.min(400_000, Math.max(100, Math.round(px * 75)));

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Relationship = readonly [id: string, type: string, target: string, external?: boolean];

export function relationships(rels: readonly Relationship[]): XmlElement {
  return el(
    'Relationships',
    { xmlns: NS.rels },
    ...rels.map(([Id, Type, Target]) => el('Relationship', { Id, Type, Target }))
  );
}

/** A PresentationML root with the three namespaces every part uses. */
export function pml(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  ...children: (XmlElement | null | undefined | false)[]
): XmlElement {
  return el(
    name,
    { 'xmlns:a': NS.a, 'xmlns:r': NS.r, 'xmlns:p': NS.p, ...attributes },
    ...children
  );
}

export function shapeTree(...shapes: XmlElement[]): XmlElement {
  return el(
    'p:spTree',
    {},
    el('p:nvGrpSpPr', {}, el('p:cNvPr', { id: 1, name: '' }), el('p:cNvGrpSpPr'), el('p:nvPr')),
    el(
      'p:grpSpPr',
      {},
      el(
        'a:xfrm',
        {},
        el('a:off', { x: 0, y: 0 }),
        el('a:ext', { cx: 0, cy: 0 }),
        el('a:chOff', { x: 0, y: 0 }),
        el('a:chExt', { cx: 0, cy: 0 })
      )
    ),
    ...shapes
  );
}

export function xfrm(frame: Frame, tag = 'a:xfrm'): XmlElement {
  return el(
    tag,
    {},
    el('a:off', { x: emu(frame.x), y: emu(frame.y) }),
    el('a:ext', { cx: Math.max(1, emu(frame.w)), cy: Math.max(1, emu(frame.h)) })
  );
}

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;

/** `#rrggbb` or `#rgb` to OOXML `RRGGBB`; anything else is `fallback`. */
export function hexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const six = HEX6.exec(value.trim());
    if (six) return (six[1] as string).toUpperCase();
    const three = HEX3.exec(value.trim());
    if (three)
      return `${three[1]}${three[1]}${three[2]}${three[2]}${three[3]}${three[3]}`.toUpperCase();
  }
  return fallback;
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function inkOn(hex: string): string {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? 'FFFFFF' : '000000';
}

export function solidFill(hex: string, alpha?: number): XmlElement {
  return el(
    'a:solidFill',
    {},
    el(
      'a:srgbClr',
      { val: hex },
      alpha !== undefined && alpha < 1
        ? el('a:alpha', { val: Math.round(Math.max(0, alpha) * 100_000) })
        : null
    )
  );
}

export type FontRole = 'major' | 'minor' | 'mono';

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Canvas pixels; defaults to the paragraph size. */
  size?: number;
  font?: FontRole;
  /** `RRGGBB`; defaults to the paragraph color. */
  color?: string;
}

export interface Paragraph {
  runs: Run[];
  size: number;
  align?: 'l' | 'ctr' | 'r';
  bullet?: boolean;
  /** Numbered list item (`1.`, `2.` …). */
  numbered?: boolean;
  /** Space after the paragraph in canvas pixels. */
  after?: number;
}

export interface TextStyle {
  lang: string;
  rtl: boolean;
  /** Default run color (`RRGGBB`). */
  color: string;
  mono: string;
}

/** Split text into lines, keeping empty lines as empty paragraphs. */
export function textLines(value: string): string[] {
  return value.split(/\r\n|\r|\n/u);
}

/** One paragraph of plain text in one style. */
export function para(
  text: string,
  size: number,
  run: Omit<Run, 'text'> = {},
  extra: Partial<Paragraph> = {}
): Paragraph {
  return { runs: [{ text, ...run }], size, ...extra };
}

function runXml(run: Run, paragraph: Paragraph, style: TextStyle): XmlElement {
  const typeface =
    run.font === 'mono'
      ? style.mono
      : run.font === 'major'
        ? '+mj-lt'
        : run.font === 'minor'
          ? '+mn-lt'
          : undefined;
  return el(
    'a:r',
    {},
    el(
      'a:rPr',
      {
        lang: style.lang,
        sz: fontSize(run.size ?? paragraph.size),
        b: run.bold ? true : undefined,
        i: run.italic ? true : undefined,
        dirty: false,
      },
      solidFill(run.color ?? style.color),
      typeface ? el('a:latin', { typeface }) : null,
      typeface && run.font === 'mono' ? el('a:cs', { typeface }) : null
    ),
    el('a:t', {}, run.text)
  );
}

function paragraphXml(paragraph: Paragraph, style: TextStyle): XmlElement {
  const runs = paragraph.runs.filter((run) => run.text.length > 0);
  const list = paragraph.bullet || paragraph.numbered;
  const pPr = el(
    'a:pPr',
    {
      marL: list ? 342_900 : undefined,
      indent: list ? -342_900 : undefined,
      algn: paragraph.align,
      rtl: style.rtl ? true : undefined,
    },
    paragraph.after
      ? el('a:spcAft', {}, el('a:spcPts', { val: Math.round(paragraph.after * 75) }))
      : null,
    paragraph.bullet ? el('a:buFont', { typeface: 'Arial' }) : null,
    paragraph.bullet
      ? el('a:buChar', { char: '•' })
      : paragraph.numbered
        ? el('a:buAutoNum', { type: 'arabicPeriod' })
        : null
  );
  return el(
    'a:p',
    {},
    pPr,
    ...runs.map((run) => runXml(run, paragraph, style)),
    el('a:endParaRPr', { lang: style.lang, sz: fontSize(paragraph.size), dirty: false })
  );
}

export interface BodyOptions {
  anchor?: 't' | 'ctr' | 'b';
  /** Shrink text on overflow (PowerPoint and LibreOffice honor it when they lay out). */
  autofit?: boolean;
  inset?: number;
}

export function textBody(
  paragraphs: readonly Paragraph[],
  style: TextStyle,
  options: BodyOptions = {},
  tag = 'p:txBody'
): XmlElement {
  const inset = options.inset === undefined ? undefined : emu(options.inset);
  return el(
    tag,
    {},
    el(
      'a:bodyPr',
      {
        wrap: 'square',
        lIns: inset,
        tIns: inset,
        rIns: inset,
        bIns: inset,
        anchor: options.anchor,
        rtlCol: style.rtl ? true : undefined,
      },
      options.autofit === false ? el('a:noAutofit') : el('a:normAutofit')
    ),
    el('a:lstStyle'),
    ...(paragraphs.length > 0 ? paragraphs : [para('', 18)]).map((paragraph) =>
      paragraphXml(paragraph, style)
    )
  );
}

export interface Placeholder {
  type: 'title' | 'ctrTitle' | 'subTitle' | 'body' | 'pic';
  idx?: number;
}

export function placeholderXml(placeholder: Placeholder): XmlElement {
  return el('p:ph', { type: placeholder.type, idx: placeholder.idx });
}

export interface ShapeOptions extends BodyOptions {
  placeholder?: Placeholder;
  geometry?: 'rect' | 'roundRect' | 'ellipse';
  fill?: string;
  fillAlpha?: number;
  line?: string;
  /** Hide from PowerPoint's reading order and selection (a decorative shape). */
  decorative?: boolean;
}

/** A positioned shape: a text box, a filled card, or a placeholder holding text. */
export function shape(
  id: number,
  name: string,
  frame: Frame,
  paragraphs: readonly Paragraph[] | null,
  style: TextStyle,
  options: ShapeOptions = {}
): XmlElement {
  const placeholder = options.placeholder;
  return el(
    'p:sp',
    {},
    el(
      'p:nvSpPr',
      {},
      el('p:cNvPr', { id, name }),
      placeholder
        ? el('p:cNvSpPr', {}, el('a:spLocks', { noGrp: true }))
        : el('p:cNvSpPr', { txBox: paragraphs && !options.fill ? true : undefined }),
      el('p:nvPr', {}, placeholder ? placeholderXml(placeholder) : null)
    ),
    el(
      'p:spPr',
      {},
      xfrm(frame),
      el('a:prstGeom', { prst: options.geometry ?? 'rect' }, el('a:avLst')),
      options.fill
        ? solidFill(options.fill, options.fillAlpha)
        : placeholder
          ? null
          : el('a:noFill'),
      options.line
        ? el('a:ln', { w: 12_700 }, solidFill(options.line))
        : placeholder
          ? null
          : el('a:ln', {}, el('a:noFill'))
    ),
    paragraphs ? textBody(paragraphs, style, options) : null
  );
}

export interface PictureOptions {
  placeholder?: Placeholder;
  /** `a:srcRect` crop in 1/1000 percent per edge (cover fit). */
  crop?: { l: number; t: number; r: number; b: number };
  geometry?: 'rect' | 'ellipse';
}

export function picture(
  id: number,
  name: string,
  relId: string,
  frame: Frame,
  alt: string,
  options: PictureOptions = {}
): XmlElement {
  const crop = options.crop;
  return el(
    'p:pic',
    {},
    el(
      'p:nvPicPr',
      {},
      el('p:cNvPr', { id, name, descr: alt || undefined }),
      el(
        'p:cNvPicPr',
        {},
        el('a:picLocks', { noChangeAspect: true, noGrp: options.placeholder ? true : undefined })
      ),
      el('p:nvPr', {}, options.placeholder ? placeholderXml(options.placeholder) : null)
    ),
    el(
      'p:blipFill',
      {},
      el('a:blip', { 'r:embed': relId }),
      crop && (crop.l || crop.t || crop.r || crop.b) ? el('a:srcRect', crop) : null,
      el('a:stretch', {}, el('a:fillRect'))
    ),
    el(
      'p:spPr',
      {},
      xfrm(frame),
      el('a:prstGeom', { prst: options.geometry ?? 'rect' }, el('a:avLst'))
    )
  );
}

export interface TableColors {
  header: string;
  headerInk: string;
  band: string;
  body: string;
  border: string;
  ink: string;
}

function cellBorder(tag: string, color: string): XmlElement {
  return el(tag, { w: 9_525 }, solidFill(color));
}

/** A native DrawingML table (`a:tbl`) with explicit fills, so every reader paints the same. */
export function table(
  id: number,
  name: string,
  frame: Frame,
  rows: readonly (readonly string[])[],
  style: TextStyle,
  colors: TableColors,
  textSize: number
): XmlElement {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const columnWidth = Math.max(1, Math.floor(emu(frame.w) / columns));
  const rowHeight = Math.max(1, Math.floor(emu(frame.h) / Math.max(rows.length, 1)));
  const tableRows = rows.map((row, rowIndex) =>
    el(
      'a:tr',
      { h: rowHeight },
      ...Array.from({ length: columns }, (_unused, columnIndex) => {
        const header = rowIndex === 0;
        const ink = header ? colors.headerInk : colors.ink;
        const cellStyle = { ...style, color: ink };
        const fill = header ? colors.header : rowIndex % 2 === 0 ? colors.band : colors.body;
        return el(
          'a:tc',
          {},
          textBody(
            [para(row[columnIndex] ?? '', textSize, { bold: header || columnIndex === 0 })],
            cellStyle,
            { autofit: false },
            'a:txBody'
          ),
          el(
            'a:tcPr',
            { anchor: 'ctr' },
            cellBorder('a:lnL', colors.border),
            cellBorder('a:lnR', colors.border),
            cellBorder('a:lnT', colors.border),
            cellBorder('a:lnB', colors.border),
            solidFill(fill)
          )
        );
      })
    )
  );
  return el(
    'p:graphicFrame',
    {},
    el(
      'p:nvGraphicFramePr',
      {},
      el('p:cNvPr', { id, name }),
      el('p:cNvGraphicFramePr', {}, el('a:graphicFrameLocks', { noGrp: true })),
      el('p:nvPr')
    ),
    xfrm(frame, 'p:xfrm'),
    el(
      'a:graphic',
      {},
      el(
        'a:graphicData',
        { uri: 'http://schemas.openxmlformats.org/drawingml/2006/table' },
        el(
          'a:tbl',
          {},
          el('a:tblPr', { firstRow: true, bandRow: true }),
          el(
            'a:tblGrid',
            {},
            ...Array.from({ length: columns }, () => el('a:gridCol', { w: columnWidth }))
          ),
          ...tableRows
        )
      )
    )
  );
}

export type BackgroundFill =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; angle: number; stops: string[] }
  | { kind: 'pattern'; preset: string; fg: string; bg: string }
  | { kind: 'picture'; relId: string; crop?: { l: number; t: number; r: number; b: number } };

/** `p:bg` for a slide (or the master). CSS gradient angles convert to DrawingML's clockwise-from-east. */
export function background(fill: BackgroundFill): XmlElement {
  let paint: XmlElement;
  switch (fill.kind) {
    case 'solid':
      paint = solidFill(fill.color);
      break;
    case 'gradient': {
      const count = Math.max(fill.stops.length - 1, 1);
      const angle = (((fill.angle - 90) % 360) + 360) % 360;
      paint = el(
        'a:gradFill',
        { rotWithShape: true },
        el(
          'a:gsLst',
          {},
          ...fill.stops.map((stop, index) =>
            el(
              'a:gs',
              { pos: Math.round((index / count) * 100_000) },
              el('a:srgbClr', { val: stop })
            )
          )
        ),
        el('a:lin', { ang: Math.round(angle * 60_000), scaled: false })
      );
      break;
    }
    case 'pattern':
      paint = el(
        'a:pattFill',
        { prst: fill.preset },
        el('a:fgClr', {}, el('a:srgbClr', { val: fill.fg })),
        el('a:bgClr', {}, el('a:srgbClr', { val: fill.bg }))
      );
      break;
    case 'picture':
      paint = el(
        'a:blipFill',
        { dpi: 0, rotWithShape: true },
        el('a:blip', { 'r:embed': fill.relId }),
        fill.crop ? el('a:srcRect', fill.crop) : null,
        el('a:stretch', {}, el('a:fillRect'))
      );
      break;
  }
  return el('p:bg', {}, el('p:bgPr', {}, paint, el('a:effectLst')));
}

export const COLOR_MAP = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hlink',
  folHlink: 'folHlink',
} as const;

export interface ThemeColors {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
}

export interface ThemeFonts {
  major: string;
  minor: string;
}

export function themeXml(name: string, colors: ThemeColors, fonts: ThemeFonts): XmlElement {
  const color = (key: keyof ThemeColors) =>
    el(`a:${key}`, {}, el('a:srgbClr', { val: colors[key] }));
  const font = (tag: string, typeface: string) =>
    el(
      tag,
      {},
      el('a:latin', { typeface }),
      el('a:ea', { typeface: '' }),
      el('a:cs', { typeface: '' })
    );
  const phFill = () => el('a:solidFill', {}, el('a:schemeClr', { val: 'phClr' }));
  const three = (make: () => XmlElement) => [make(), make(), make()];
  return el(
    'a:theme',
    { 'xmlns:a': NS.a, name },
    el(
      'a:themeElements',
      {},
      el(
        'a:clrScheme',
        { name },
        ...(
          [
            'dk1',
            'lt1',
            'dk2',
            'lt2',
            'accent1',
            'accent2',
            'accent3',
            'accent4',
            'accent5',
            'accent6',
            'hlink',
            'folHlink',
          ] as const
        ).map(color)
      ),
      el(
        'a:fontScheme',
        { name },
        font('a:majorFont', fonts.major),
        font('a:minorFont', fonts.minor)
      ),
      el(
        'a:fmtScheme',
        { name },
        el('a:fillStyleLst', {}, ...three(phFill)),
        el('a:lnStyleLst', {}, ...three(() => el('a:ln', { w: 6_350 }, phFill()))),
        el('a:effectStyleLst', {}, ...three(() => el('a:effectStyle', {}, el('a:effectLst')))),
        el('a:bgFillStyleLst', {}, ...three(phFill))
      )
    )
  );
}

/** Master text styles: titles in the major font, body in the minor font, no default bullets. */
export function textStyles(): XmlElement {
  const level = (size: number, bold: boolean, typeface: string) =>
    el(
      'a:lvl1pPr',
      { marL: 0, indent: 0 },
      el('a:buNone'),
      el(
        'a:defRPr',
        { sz: size, b: bold ? true : undefined },
        el('a:solidFill', {}, el('a:schemeClr', { val: 'tx1' })),
        el('a:latin', { typeface }),
        el('a:ea', { typeface: '+mn-ea' }),
        el('a:cs', { typeface: '+mn-cs' })
      )
    );
  return el(
    'p:txStyles',
    {},
    el('p:titleStyle', {}, level(fontSize(44), true, '+mj-lt')),
    el('p:bodyStyle', {}, level(fontSize(24), false, '+mn-lt')),
    el('p:otherStyle', {}, level(fontSize(18), false, '+mn-lt'))
  );
}
