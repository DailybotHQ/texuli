/**
 * PPTX for deck model v2: owned, dependency-free and deterministic. The
 * `@texuli/slides/export` entry loads this module on first use (it carries
 * the layout geometry and the model resolvers, too large for the entry).
 *
 * What the file holds:
 * - one slide master and one slide layout per deck layout (the 20 catalog
 *   layouts and `free`; component and custom slides use `free`), with title,
 *   body and picture placeholders, so the outline lists every slide title;
 * - slides at the deck canvas size (1px = 1/96in, the print page), every
 *   reveal step shown (the final state), hidden slides as PowerPoint hidden
 *   slides (or left out with `hidden: 'skip'`);
 * - text in placeholders and shapes, native `a:tbl` tables (comparison
 *   tables and table blocks), pictures from host-supplied bytes
 *   (`loadImage`), charts as pictures from a host snapshot (`snapshotChart`);
 * - theme colors and fonts from the resolved palette, per-slide backgrounds
 *   (solid, gradient, pattern, image) with the contrast scrim, speaker notes.
 *
 * Security: the writer never fetches. `loadImage` receives the source as
 * authored and the host decides (URL policy, fetch, size); bytes are checked
 * against their declared type and size caps before they are embedded. No
 * link becomes clickable: link targets are written as text.
 *
 * Everything not mapped is listed in `omitted` with the slide id and path,
 * and (unless `noteOmissions` is false) in that slide's notes page.
 */
import {
  DECK_CANVAS,
  DECK_LAYOUT_IDS,
  DECK_LAYOUTS,
  type Deck,
  type DeckAspect,
  type DeckBackgroundPalette,
  type DeckLayoutId,
  type DeckSlide,
  normalizeThemeReference,
  resolveDeckBackground,
} from '@texuli/deck/model';
import type { DeckMediaTrust } from '../stage/media.ts';
import { PPTX_CANVAS_SLIDE_SIZES } from './canvas.ts';
import { deckExportFilename } from './filename.ts';
import {
  type BackgroundFill,
  background,
  COLOR_MAP,
  type Frame,
  hexColor,
  inkOn,
  NS,
  type Paragraph,
  type Placeholder,
  PML,
  para,
  picture,
  pml,
  REL,
  type Relationship,
  relationships,
  type ShapeOptions,
  shape,
  shapeTree,
  type TextStyle,
  table,
  textLines,
  textStyles,
  themeXml,
} from './pptx-ooxml.ts';
import { el, serializeXml, type XmlElement } from './xml.ts';
import { writeZip } from './zip.ts';

export const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export type DeckPptxImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/bmp';

/** Raster bytes a host hands to the writer. */
export interface DeckPptxImageAsset {
  bytes: Uint8Array;
  mimeType: DeckPptxImageMime;
  /** Intrinsic pixel size; read from the bytes when absent (PNG, GIF, JPEG, BMP). */
  width?: number;
  height?: number;
}

export interface DeckPptxAssetContext {
  slideId: string;
  /** JSON path of the source inside the slide (`$.props.image.src`). */
  path: string;
  kind: 'image' | 'avatar' | 'background' | 'poster';
  /** The URL policy tier the host painted the deck at (`options.tier`): apply it. */
  tier: DeckMediaTrust;
}

export interface DeckPptxChartContext {
  slideId: string;
  path: string;
  /** The URL policy tier the host painted the deck at (`options.tier`). */
  tier: DeckMediaTrust;
  /** The picture frame in canvas pixels: render at this size (or a multiple). */
  width: number;
  height: number;
}

type Maybe<T> = T | null | undefined;

export interface DeckPptxV2Options {
  /** Write speaker notes pages. Default true. */
  notes?: boolean;
  /**
   * The URL policy tier of the deck, the one the host gives `DeckStage`
   * (default `untrusted`). The writer never fetches; it hands the tier to
   * `loadImage` and `snapshotChart` in their context so the host applies the
   * same policy (for example `safeImageSrc(src, context.tier)`).
   */
  tier?: DeckMediaTrust;
  /**
   * Resolve an image source to bytes. The host applies its URL policy and
   * fetches; return nothing to leave the image out (it is then reported).
   */
  loadImage?: (
    src: string,
    context: DeckPptxAssetContext
  ) => Maybe<DeckPptxImageAsset> | Promise<Maybe<DeckPptxImageAsset>>;
  /**
   * Rasterize a chart (a Texuli chart block: `{ type: 'chart', kind, … }`).
   * Without it, charts are omitted with a reason and their title stays.
   */
  snapshotChart?: (
    chart: Record<string, unknown>,
    context: DeckPptxChartContext
  ) => Maybe<DeckPptxImageAsset> | Promise<Maybe<DeckPptxImageAsset>>;
  /**
   * The resolved theme palette (`#rrggbb` per role), for the deck theme and
   * backgrounds. A function gets each slide (and `undefined` for the deck
   * theme). Default: the embedded theme's colors, else a neutral palette.
   */
  palette?:
    | DeckBackgroundPalette
    | ((slide: DeckSlide | undefined) => Maybe<DeckBackgroundPalette>);
  /** Font families for the theme (first concrete family of a CSS list is used). */
  fonts?: { heading?: string; body?: string; mono?: string };
  /**
   * Design values (ADR-024), as `designValues(compiled, mode)` from
   * `@texuli/tools/print` builds them from a compiled design system: the
   * theme palette (`#rrggbb` per role; `accent` reads `chart2`) and fonts
   * for the deck theme and every slide. `palette` and `fonts`, when given,
   * still win. Default: none, and the output is unchanged.
   */
  design?: DeckPptxDesign | null;
  /** List each slide's omissions on its notes page. Default true (needs `notes`). */
  noteOmissions?: boolean;
  /**
   * Hidden slides: `include` (default) writes them as PowerPoint hidden
   * slides (in the file, skipped in the slide show); `skip` leaves them out.
   */
  hidden?: 'include' | 'skip';
}

/** The design roles the PPTX theme reads. */
export type DeckPptxDesignRole = Exclude<keyof DeckBackgroundPalette, 'accent'> | 'chart2';

/** Design values for a PPTX theme: colors per role and CSS font stacks. */
export interface DeckPptxDesign {
  colors?: Readonly<Partial<Record<DeckPptxDesignRole, string>>>;
  fonts?: Readonly<{ sans?: string; heading?: string; mono?: string }>;
}

export type DeckPptxOmissionKind =
  | 'image'
  | 'chart'
  | 'video'
  | 'component'
  | 'custom'
  | 'background'
  | 'block'
  | 'link';

export interface DeckPptxV2Omission {
  slideId: string;
  kind: DeckPptxOmissionKind;
  path: string;
  reason: string;
}

export interface DeckPptxV2Part {
  path: string;
  contentType: string | null;
  xml: string;
}

export interface DeckPptxV2Media {
  path: string;
  mimeType: DeckPptxImageMime;
  bytes: Uint8Array;
}

export interface DeckPptxV2Package {
  filename: string;
  parts: DeckPptxV2Part[];
  media: DeckPptxV2Media[];
  omitted: DeckPptxV2Omission[];
}

export interface DeckPptxV2Written {
  filename: string;
  bytes: Uint8Array;
  omitted: DeckPptxV2Omission[];
}

export interface DeckPptxV2Export {
  filename: string;
  blob: Blob;
  omitted: DeckPptxV2Omission[];
}

/** Per-image and per-file caps on embedded bytes. */
export const PPTX_MEDIA_LIMITS = Object.freeze({
  imageBytes: 25 * 1024 * 1024,
  totalBytes: 200 * 1024 * 1024,
});

/** Longest string written from one field (the model caps lower; this guards hand-built decks). */
const MAX_TEXT = 20_000;

const MIME_EXT: Readonly<Record<DeckPptxImageMime, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

const NEUTRAL_PALETTES: Readonly<Record<'light' | 'dark', DeckBackgroundPalette>> = {
  light: {
    background: '#ffffff',
    foreground: '#18181b',
    surface: '#f4f4f5',
    primary: '#2563eb',
    accent: '#7c3aed',
    muted: '#e4e4e7',
    border: '#d4d4d8',
    info: '#0369a1',
    success: '#15803d',
    warning: '#a16207',
    destructive: '#b91c1c',
  },
  dark: {
    background: '#09090b',
    foreground: '#fafafa',
    surface: '#18181b',
    primary: '#60a5fa',
    accent: '#a78bfa',
    muted: '#27272a',
    border: '#3f3f46',
    info: '#38bdf8',
    success: '#4ade80',
    warning: '#facc15',
    destructive: '#f87171',
  },
};

const PALETTE_ROLES = Object.keys(NEUTRAL_PALETTES.light) as (keyof DeckBackgroundPalette)[];

// ---------------------------------------------------------------------------
// Small readers (the deck is validated, but hand-built input must not throw)

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A string field, clipped; anything else is ''. */
function str(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
}

/** Light Markdown markers stripped, line breaks kept (text blocks are Markdown). */
function stripLightMarkdown(source: string): string {
  return source
    .replace(/```[^\n]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .trim();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function propsOf(slide: DeckSlide): Bag {
  const props = (slide as { props?: unknown }).props;
  return isBag(props) ? props : {};
}

/** The slide title the outline lists: `slide.title`, else the layout's own title prop. */
export function pptxSlideTitle(slide: DeckSlide): string {
  if (typeof slide.title === 'string' && slide.title.trim()) return str(slide.title);
  const title = propsOf(slide).title;
  return typeof title === 'string' ? str(title) : '';
}

// ---------------------------------------------------------------------------
// Images: byte checks and intrinsic size

const MAGIC: Readonly<Record<DeckPptxImageMime, readonly number[]>> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/bmp': [0x42, 0x4d],
};

function u16be(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function u32be(bytes: Uint8Array, at: number): number {
  return ((u16be(bytes, at) << 16) >>> 0) + u16be(bytes, at + 2);
}

function u16le(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

/** Intrinsic size from the image header (PNG IHDR, GIF screen, JPEG SOFn, BMP DIB). */
export function sniffImageSize(
  bytes: Uint8Array,
  mimeType: DeckPptxImageMime
): { width: number; height: number } | undefined {
  let width = 0;
  let height = 0;
  if (mimeType === 'image/png' && bytes.length >= 24) {
    width = u32be(bytes, 16);
    height = u32be(bytes, 20);
  } else if (mimeType === 'image/gif' && bytes.length >= 10) {
    width = u16le(bytes, 6);
    height = u16le(bytes, 8);
  } else if (mimeType === 'image/bmp' && bytes.length >= 26) {
    width = u16le(bytes, 18) | (u16le(bytes, 20) << 16);
    height = Math.abs(u16le(bytes, 22) | (u16le(bytes, 24) << 16));
  } else if (mimeType === 'image/jpeg') {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return undefined;
      const marker = bytes[at + 1] ?? 0;
      const length = u16be(bytes, at + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        height = u16be(bytes, at + 5);
        width = u16be(bytes, at + 7);
        break;
      }
      if (length < 2) return undefined;
      at += 2 + length;
    }
  }
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function checkAsset(
  asset: unknown,
  budget: { used: number }
): { asset: DeckPptxImageAsset; width?: number; height?: number } | { reason: string } {
  if (!isBag(asset)) return { reason: 'The host returned no image bytes.' };
  const { bytes, mimeType } = asset as Partial<DeckPptxImageAsset>;
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    return { reason: 'The host returned no image bytes.' };
  }
  if (typeof mimeType !== 'string' || !Object.hasOwn(MIME_EXT, mimeType)) {
    return { reason: 'Only PNG, JPEG, GIF and BMP images can be embedded.' };
  }
  const magic = MAGIC[mimeType as DeckPptxImageMime];
  if (!magic.every((byte, index) => bytes[index] === byte)) {
    return { reason: `The image bytes are not a valid ${mimeType} file.` };
  }
  if (bytes.length > PPTX_MEDIA_LIMITS.imageBytes) {
    return { reason: 'The image is larger than the 25 MiB embed limit.' };
  }
  if (budget.used + bytes.length > PPTX_MEDIA_LIMITS.totalBytes) {
    return { reason: 'The file reached its 200 MiB media limit.' };
  }
  const declared =
    Number.isInteger(asset.width) &&
    Number.isInteger(asset.height) &&
    (asset.width as number) > 0 &&
    (asset.height as number) > 0
      ? { width: asset.width as number, height: asset.height as number }
      : sniffImageSize(bytes, mimeType as DeckPptxImageMime);
  return { asset: { bytes, mimeType: mimeType as DeckPptxImageMime }, ...declared };
}

/** Fit a picture of `width × height` into `frame`: `contain` shrinks the frame, `cover` crops. */
function fitPicture(
  frame: Frame,
  size: { width?: number; height?: number },
  fit: 'contain' | 'cover'
): { frame: Frame; crop?: { l: number; t: number; r: number; b: number } } {
  if (!size.width || !size.height || frame.w <= 0 || frame.h <= 0) return { frame };
  const imageRatio = size.width / size.height;
  const frameRatio = frame.w / frame.h;
  if (fit === 'contain') {
    if (imageRatio > frameRatio) {
      const h = frame.w / imageRatio;
      return { frame: { ...frame, y: frame.y + (frame.h - h) / 2, h } };
    }
    const w = frame.h * imageRatio;
    return { frame: { ...frame, x: frame.x + (frame.w - w) / 2, w } };
  }
  if (Math.abs(imageRatio - frameRatio) < 0.001) return { frame };
  if (imageRatio > frameRatio) {
    const side = Math.round(((1 - frameRatio / imageRatio) / 2) * 100_000);
    return { frame, crop: { l: side, t: 0, r: side, b: 0 } };
  }
  const side = Math.round(((1 - imageRatio / frameRatio) / 2) * 100_000);
  return { frame, crop: { l: 0, t: side, r: 0, b: side } };
}

// ---------------------------------------------------------------------------
// Theme: palette and fonts

function readPaletteColor(value: unknown): string | undefined {
  const raw = isBag(value) ? value.default : value;
  if (typeof raw !== 'string') return undefined;
  const hex = hexColor(raw, '');
  return hex ? `#${hex.toLowerCase()}` : undefined;
}

function paletteFor(
  deck: Deck,
  slide: DeckSlide | undefined,
  options: DeckPptxV2Options
): DeckBackgroundPalette {
  const reference = normalizeThemeReference(slide?.theme ?? deck.style?.theme);
  const mode = reference?.mode === 'dark' ? 'dark' : 'light';
  const base = NEUTRAL_PALETTES[mode];
  const host = typeof options.palette === 'function' ? options.palette(slide) : options.palette;
  const design = options.design?.colors;
  const embedded: Bag | undefined =
    reference?.kind === 'embedded' && isBag(reference.theme) && isBag(reference.theme[mode])
      ? (reference.theme[mode] as Bag)
      : undefined;
  // Design values layer over the embedded theme; a host palette replaces both.
  const source: Bag | undefined = isBag(host)
    ? host
    : isBag(design)
      ? { ...embedded, ...design, accent: design.chart2 ?? embedded?.accent }
      : embedded;
  if (!source) return base;
  const out: Record<string, string> = { ...base };
  for (const role of PALETTE_ROLES) {
    const color = readPaletteColor(source[role]);
    if (color) out[role] = color;
  }
  return out as unknown as DeckBackgroundPalette;
}

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont',
]);

/** The first concrete family of a CSS font-family list (no generics, no `var()`). */
export function firstFontFamily(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  for (const part of value.split(',')) {
    const name = part
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();
    if (!name || name.includes('(') || GENERIC_FAMILIES.has(name.toLowerCase())) continue;
    if (!/^[\p{L}\p{N} ._-]{1,64}$/u.test(name)) continue;
    return name;
  }
  return undefined;
}

function themeFonts(
  deck: Deck,
  options: DeckPptxV2Options
): { major: string; minor: string; mono: string } {
  const reference = normalizeThemeReference(deck.style?.theme);
  const theme: Bag =
    reference?.kind === 'embedded' && isBag(reference.theme) ? reference.theme : {};
  const design = options.design?.fonts;
  const minor =
    firstFontFamily(options.fonts?.body) ??
    firstFontFamily(design?.sans) ??
    firstFontFamily(theme.fontFamily) ??
    'Calibri';
  const major =
    firstFontFamily(options.fonts?.heading) ??
    firstFontFamily(design?.heading) ??
    firstFontFamily(theme.fontFamilyHeading) ??
    minor;
  const mono =
    firstFontFamily(options.fonts?.mono) ??
    firstFontFamily(design?.mono) ??
    firstFontFamily(theme.fontFamilyMono) ??
    'Courier New';
  return { major, minor, mono };
}

// ---------------------------------------------------------------------------
// Geometry: one table of placeholder frames per layout, in canvas pixels

interface Canvas {
  W: number;
  H: number;
  /** Unit: 1 at 720px on the short side. */
  u: number;
  M: number;
  portrait: boolean;
}

function canvasFor(aspect: DeckAspect): Canvas {
  const { width: W, height: H } = DECK_CANVAS[aspect] ?? DECK_CANVAS['16:9'];
  const u = Math.min(W, H) / 720;
  return { W, H, u, M: Math.round(64 * u), portrait: H > W };
}

function titleFrame(c: Canvas): Frame {
  return { x: c.M, y: Math.round(c.M * 0.75), w: c.W - 2 * c.M, h: Math.round(112 * c.u) };
}

function contentFrame(c: Canvas): Frame {
  const title = titleFrame(c);
  const y = title.y + title.h + Math.round(24 * c.u);
  return { x: c.M, y, w: c.W - 2 * c.M, h: c.H - y - c.M };
}

/** Split a frame into `count` parts in a row (or a column when `vertical`), by weight. */
function split(
  frame: Frame,
  count: number,
  gap: number,
  vertical: boolean,
  weights?: number[]
): Frame[] {
  const parts = Math.max(1, count);
  const w = weights && weights.length === parts ? weights : Array.from({ length: parts }, () => 1);
  const total = w.reduce((sum, value) => sum + value, 0);
  const free = (vertical ? frame.h : frame.w) - gap * (parts - 1);
  const out: Frame[] = [];
  let at = vertical ? frame.y : frame.x;
  for (const weight of w) {
    const length = (free * weight) / total;
    out.push(
      vertical
        ? { x: frame.x, y: at, w: frame.w, h: length }
        : { x: at, y: frame.y, w: length, h: frame.h }
    );
    at += length + gap;
  }
  return out;
}

function band(c: Canvas, top: number, height: number, inset = c.M): Frame {
  return { x: inset, y: Math.round(c.H * top), w: c.W - 2 * inset, h: Math.round(c.H * height) };
}

interface PlaceholderSpec {
  key: string;
  name: string;
  ph: Placeholder;
  frame: Frame;
}

const TITLE: Placeholder = { type: 'title' };
const body = (idx: number): Placeholder => ({ type: 'body', idx });
const PICTURE: Placeholder = { type: 'pic', idx: 10 };

/** OOXML layout types where one fits; the rest are custom (`cust`). */
const LAYOUT_TYPES: Partial<Record<DeckLayoutId, string>> = {
  'title-hero': 'title',
  'section-divider': 'secHead',
  'two-column-split': 'twoObj',
  'image-left': 'picTx',
  'image-right': 'picTx',
  'comparison-table': 'titleOnly',
  'process-steps': 'titleOnly',
  'team-avatars': 'titleOnly',
  timeline: 'titleOnly',
  free: 'obj',
};

function layoutPlaceholders(id: DeckLayoutId, c: Canvas): PlaceholderSpec[] {
  const title = titleFrame(c);
  const content = contentFrame(c);
  const gap = Math.round(32 * c.u);
  const spec = (key: string, name: string, ph: Placeholder, frame: Frame): PlaceholderSpec => ({
    key,
    name,
    ph,
    frame,
  });
  const titleSpec = spec('title', 'Title', TITLE, title);
  const smallTitle = spec('title', 'Title', TITLE, { ...title, h: Math.round(72 * c.u) });
  switch (id) {
    case 'title-hero':
      return [
        spec('title', 'Title', { type: 'ctrTitle' }, band(c, 0.26, 0.28)),
        spec('subtitle', 'Subtitle', { type: 'subTitle', idx: 1 }, band(c, 0.56, 0.24)),
      ];
    case 'section-divider':
      return [
        spec('eyebrow', 'Eyebrow', body(1), band(c, 0.26, 0.1)),
        spec('title', 'Title', TITLE, band(c, 0.37, 0.34)),
      ];
    case 'closing-cta':
      return [
        spec('title', 'Title', { type: 'ctrTitle' }, band(c, 0.16, 0.26)),
        spec('text', 'Text', body(1), band(c, 0.44, 0.16)),
        spec('footnote', 'Footnote', body(2), band(c, 0.84, 0.08)),
      ];
    case 'two-column-split': {
      const [left, right] = split(content, 2, gap, c.portrait) as [Frame, Frame];
      return [
        titleSpec,
        spec('left', 'Left column', body(1), left),
        spec('right', 'Right column', body(2), right),
      ];
    }
    case 'three-column-cards': {
      const cards = split(content, 3, gap, c.portrait);
      return [
        titleSpec,
        ...cards.map((frame, index) =>
          spec(`card${index}`, `Card ${index + 1}`, body(index + 1), frame)
        ),
      ];
    }
    case 'image-left':
    case 'image-right':
    case 'video-left':
    case 'video-right': {
      const [first, second] = split(content, 2, gap, c.portrait) as [Frame, Frame];
      const mediaFirst = id.endsWith('-left') || c.portrait;
      const media = mediaFirst ? first : second;
      const text = mediaFirst ? second : first;
      return [
        titleSpec,
        ...(id.startsWith('image') ? [spec('media', 'Picture', PICTURE, media)] : []),
        spec('text', 'Text', body(1), text),
      ];
    }
    case 'image-centered':
    case 'video-centered':
    case 'chart': {
      const captionHeight = Math.round(64 * c.u);
      const media = { ...content, h: content.h - captionHeight - Math.round(12 * c.u) };
      const caption = { ...content, y: content.y + content.h - captionHeight, h: captionHeight };
      return [
        titleSpec,
        ...(id === 'video-centered'
          ? []
          : [
              spec(
                'media',
                id === 'chart' ? 'Chart' : 'Picture',
                PICTURE,
                id === 'chart' ? content : media
              ),
            ]),
        spec(
          'caption',
          id === 'chart' ? 'Chart text' : 'Caption',
          body(1),
          id === 'chart' ? content : caption
        ),
      ];
    }
    case 'image-full-bleed':
      return [
        spec('media', 'Picture', PICTURE, { x: 0, y: 0, w: c.W, h: c.H }),
        smallTitle,
        spec('caption', 'Caption', body(1), band(c, 0.8, 0.14)),
      ];
    case 'quote':
      return [
        smallTitle,
        spec('quote', 'Quote', body(1), band(c, 0.2, 0.46, c.M * 2)),
        spec('cite', 'Citation', body(2), band(c, 0.7, 0.1, c.M * 2)),
      ];
    case 'code-with-callout': {
      const [code, side] = split(content, 2, gap, c.portrait, [3, 2]) as [Frame, Frame];
      return [
        titleSpec,
        spec('code', 'Code', body(1), code),
        spec('side', 'Callout', body(2), side),
      ];
    }
    case 'big-stat':
      return [
        smallTitle,
        spec('number', 'Number', body(1), band(c, 0.18, 0.3)),
        spec('label', 'Label', body(2), band(c, 0.5, 0.16)),
        spec('context', 'Context', body(3), band(c, 0.68, 0.2)),
      ];
    case 'timeline':
    case 'comparison-table':
    case 'process-steps':
    case 'team-avatars':
      return [titleSpec];
    default:
      return [titleSpec, spec('body', 'Content', body(1), content)];
  }
}

function layoutLabel(id: DeckLayoutId): string {
  const entry = (DECK_LAYOUTS as Record<string, { label?: string } | undefined>)[id];
  return entry?.label ?? id;
}

// ---------------------------------------------------------------------------
// One slide

interface MediaEntry {
  path: string;
  mimeType: DeckPptxImageMime;
  bytes: Uint8Array;
}

interface PackageState {
  deck: Deck;
  options: DeckPptxV2Options;
  canvas: Canvas;
  lang: string;
  rtl: boolean;
  mono: string;
  media: MediaEntry[];
  /** Embedded media by source key, so a repeated image is stored once. */
  mediaByKey: Map<string, { entry: MediaEntry; width?: number; height?: number }>;
  budget: { used: number };
  omitted: DeckPptxV2Omission[];
}

interface Visual {
  kind: 'image' | 'table' | 'chart';
  path: string;
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  rows?: string[][];
  chart?: Record<string, unknown>;
}

class SlideBuilder {
  readonly shapes: XmlElement[] = [];
  readonly rels: Relationship[] = [];
  readonly omitted: DeckPptxV2Omission[] = [];
  bg: XmlElement | null = null;
  private nextId = 2;
  readonly frames: Map<string, PlaceholderSpec>;
  readonly text: TextStyle;
  readonly cardText: TextStyle;
  readonly state: PackageState;
  readonly slide: DeckSlide;
  readonly layout: DeckLayoutId;
  readonly palette: DeckBackgroundPalette;

  constructor(
    state: PackageState,
    slide: DeckSlide,
    layout: DeckLayoutId,
    palette: DeckBackgroundPalette,
    ink: string
  ) {
    this.state = state;
    this.slide = slide;
    this.layout = layout;
    this.palette = palette;
    this.frames = new Map(layoutPlaceholders(layout, state.canvas).map((spec) => [spec.key, spec]));
    this.text = { lang: state.lang, rtl: state.rtl, color: ink, mono: state.mono };
    this.cardText = { ...this.text, color: hexColor(palette.foreground, '18181B') };
  }

  get c(): Canvas {
    return this.state.canvas;
  }

  /** The deck's URL policy tier for host callbacks: only `developer` widens it. */
  get tier(): DeckMediaTrust {
    return this.state.options.tier === 'developer' ? 'developer' : 'untrusted';
  }

  id(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  frame(key: string): Frame {
    return this.frames.get(key)?.frame ?? contentFrame(this.c);
  }

  omit(kind: DeckPptxOmissionKind, path: string, reason: string): void {
    this.omitted.push({ slideId: this.slide.id, kind, path, reason });
  }

  /** Text into the layout placeholder `key`; empty text writes nothing. */
  placeholder(key: string, paragraphs: Paragraph[], options: ShapeOptions = {}): void {
    const spec = this.frames.get(key);
    const kept = paragraphs.filter((paragraph) => paragraph.runs.some((run) => run.text.trim()));
    if (!spec || kept.length === 0) return;
    this.shapes.push(
      shape(
        this.id(),
        spec.name,
        spec.frame,
        kept,
        options.fill ? { ...this.cardText } : this.text,
        {
          autofit: true,
          ...options,
          placeholder: spec.ph,
        }
      )
    );
  }

  /** A shape that is not a placeholder (cards, markers, bands). */
  box(
    name: string,
    frame: Frame,
    paragraphs: Paragraph[] | null,
    options: ShapeOptions = {},
    style?: TextStyle
  ): void {
    this.shapes.push(
      shape(
        this.id(),
        name,
        frame,
        paragraphs,
        style ?? (options.fill ? this.cardText : this.text),
        options
      )
    );
  }

  card(
    name: string,
    frame: Frame,
    paragraphs: Paragraph[],
    geometry: 'rect' | 'roundRect' = 'roundRect'
  ): void {
    this.box(name, frame, paragraphs, {
      geometry,
      fill: hexColor(this.palette.surface, 'F4F4F5'),
      line: hexColor(this.palette.border, 'D4D4D8'),
      inset: Math.round(20 * this.c.u),
      autofit: true,
    });
  }

  relFor(entry: MediaEntry): string {
    const target = `../media/${entry.path.split('/').at(-1)}`;
    const existing = this.rels.find((rel) => rel[2] === target);
    if (existing) return existing[0];
    const id = `rId${this.rels.length + 2}`;
    this.rels.push([id, `${REL}/image`, target]);
    return id;
  }

  /** Resolve bytes through the host; returns the stored media or the reason it is missing. */
  async media(
    key: string,
    load: () => unknown,
    missing: string
  ): Promise<{ entry: MediaEntry; width?: number; height?: number } | { reason: string }> {
    const known = this.state.mediaByKey.get(key);
    if (known) return known;
    let result: unknown;
    try {
      result = await load();
    } catch {
      return { reason: 'The host image callback failed.' };
    }
    if (result === undefined || result === null) return { reason: missing };
    const checked = checkAsset(result, this.state.budget);
    if ('reason' in checked) return checked;
    const { asset } = checked;
    const ext = MIME_EXT[asset.mimeType];
    const entry: MediaEntry = {
      path: `ppt/media/image${this.state.media.length + 1}.${ext}`,
      mimeType: asset.mimeType,
      bytes: asset.bytes,
    };
    this.state.media.push(entry);
    this.state.budget.used += asset.bytes.length;
    const stored = { entry, width: checked.width, height: checked.height };
    this.state.mediaByKey.set(key, stored);
    return stored;
  }

  async image(
    src: string,
    path: string,
    kind: DeckPptxAssetContext['kind'],
    frame: Frame,
    alt: string,
    fit: 'contain' | 'cover',
    extra: {
      placeholder?: Placeholder;
      geometry?: 'rect' | 'ellipse';
      size?: { width?: number; height?: number };
    } = {}
  ): Promise<boolean> {
    const loadImage = this.state.options.loadImage;
    if (!src) return false;
    if (!loadImage) {
      this.omit(
        kind === 'background' ? 'background' : 'image',
        path,
        'Images need the host loadImage callback.'
      );
      return false;
    }
    const stored = await this.media(
      `${kind}:${src}`,
      () => loadImage(src, { slideId: this.slide.id, path, kind, tier: this.tier }),
      'The host returned no image bytes.'
    );
    if ('reason' in stored) {
      this.omit(kind === 'background' ? 'background' : 'image', path, stored.reason);
      return false;
    }
    const size = stored.width && stored.height ? stored : (extra.size ?? {});
    const fitted = fitPicture(frame, size, fit);
    this.shapes.push(
      picture(
        this.id(),
        kind === 'avatar' ? 'Avatar' : 'Picture',
        this.relFor(stored.entry),
        fitted.frame,
        alt,
        {
          placeholder: extra.placeholder,
          crop: fitted.crop,
          geometry: extra.geometry,
        }
      )
    );
    return true;
  }

  async chart(
    chart: Record<string, unknown>,
    path: string,
    frame: Frame,
    placeholder?: Placeholder
  ): Promise<boolean> {
    const snapshot = this.state.options.snapshotChart;
    const alt = str(chart.description) || str(chart.title) || 'Chart';
    if (!snapshot) {
      this.omit(
        'chart',
        path,
        'Charts export as pictures through the host snapshotChart callback, which was not provided.'
      );
      return false;
    }
    const key = `chart:${this.slide.id}:${path}`;
    const context: DeckPptxChartContext = {
      slideId: this.slide.id,
      path,
      tier: this.tier,
      width: Math.round(frame.w),
      height: Math.round(frame.h),
    };
    const stored = await this.media(
      key,
      () => snapshot(chart, context),
      'The host returned no chart snapshot.'
    );
    if ('reason' in stored) {
      this.omit('chart', path, stored.reason);
      return false;
    }
    const fitted = fitPicture(frame, stored, 'contain');
    this.shapes.push(
      picture(this.id(), 'Chart', this.relFor(stored.entry), fitted.frame, alt, {
        placeholder,
        crop: fitted.crop,
      })
    );
    return true;
  }

  tableShape(rows: string[][], frame: Frame, name: string): void {
    const header = hexColor(this.palette.primary, '2563EB');
    const textSize = rows.length > 6 ? 16 : 20;
    const height = Math.min(frame.h, rows.length * Math.round(textSize * 2.6 * this.c.u));
    this.shapes.push(
      table(
        this.id(),
        name,
        { ...frame, h: height },
        rows,
        this.text,
        {
          header,
          headerInk: inkOn(header),
          band: hexColor(this.palette.surface, 'F4F4F5'),
          body: hexColor(this.palette.background, 'FFFFFF'),
          border: hexColor(this.palette.border, 'D4D4D8'),
          ink: hexColor(this.palette.foreground, '18181B'),
        },
        textSize
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Backgrounds

async function paintBackground(builder: SlideBuilder, deck: Deck): Promise<string> {
  const slide = builder.slide;
  const resolved = resolveDeckBackground(
    slide.background ?? deck.style?.background,
    builder.palette,
    {
      slideId: slide.id,
    }
  );
  const c = builder.c;
  let fill: BackgroundFill | undefined;
  for (const layer of resolved.layers) {
    if (layer.type === 'color') fill = { kind: 'solid', color: hexColor(layer.color, 'FFFFFF') };
    else if (layer.type === 'gradient') {
      fill = {
        kind: 'gradient',
        angle: layer.angle,
        stops: layer.stops.map((stop) => hexColor(stop, 'FFFFFF')),
      };
    } else if (layer.type === 'pattern') {
      fill = {
        kind: 'pattern',
        preset: layer.pattern === 'grid' ? 'smGrid' : 'pct10',
        fg: hexColor(layer.ink, 'D4D4D8'),
        bg: hexColor(layer.color, 'FFFFFF'),
      };
    } else if (layer.type === 'media') {
      const loadImage = builder.state.options.loadImage;
      const src = layer.media === 'image' ? layer.src : (layer.poster ?? '');
      const path = layer.media === 'image' ? '$.background.src' : '$.background.poster';
      if (!src) {
        builder.omit(
          'video',
          '$.background.src',
          'Video backgrounds are not embedded; the slide keeps its base color.'
        );
        continue;
      }
      if (layer.media === 'video') {
        builder.omit(
          'video',
          '$.background.src',
          'Video backgrounds are not embedded; the poster image is used.'
        );
      }
      if (!loadImage) {
        builder.omit('background', path, 'Background images need the host loadImage callback.');
        continue;
      }
      const stored = await builder.media(
        `background:${src}`,
        () =>
          loadImage(src, {
            slideId: slide.id,
            path,
            kind: layer.media === 'image' ? 'background' : 'poster',
            tier: builder.tier,
          }),
        'The host returned no image bytes.'
      );
      if ('reason' in stored) {
        builder.omit('background', path, stored.reason);
        continue;
      }
      const fitted = fitPicture({ x: 0, y: 0, w: c.W, h: c.H }, stored, 'cover');
      fill = { kind: 'picture', relId: builder.relFor(stored.entry), crop: fitted.crop };
    }
  }
  builder.bg = background(fill ?? { kind: 'solid', color: 'FFFFFF' });
  if (resolved.scrim > 0) {
    builder.box('Scrim', { x: 0, y: 0, w: c.W, h: c.H }, null, {
      fill: hexColor(resolved.scrimColor, '000000'),
      fillAlpha: resolved.scrim,
    });
  }
  return hexColor(resolved.textColor, '18181B');
}

// ---------------------------------------------------------------------------
// Free slides: blocks to text, tables, pictures and charts

const CONTAINER_KEYS = ['blocks', 'children'] as const;

function heading(text: string, size: number, align?: Paragraph['align']): Paragraph {
  return para(text, size, { bold: true, font: 'major' }, { align, after: 8 });
}

function textParagraphs(
  value: string,
  size: number,
  run: Parameters<typeof para>[2] = {},
  after = 6
): Paragraph[] {
  return textLines(value).map((line) => para(line, size, run, { after }));
}

function tableRowsFromBlock(block: Bag): string[][] | undefined {
  const columns = list(block.columns).filter(isBag);
  if (columns.length === 0) return undefined;
  const header = columns.map((column) => str(column.label) || str(column.id));
  const rows = list(block.rows)
    .filter(isBag)
    .map((row) => columns.map((column) => str(row[str(column.id)])));
  return [header, ...rows];
}

function walkFree(
  items: unknown[],
  path: string,
  paragraphs: Paragraph[],
  visuals: Visual[],
  builder: SlideBuilder,
  depth = 0
): void {
  items.forEach((item, index) => {
    const at = `${path}[${index}]`;
    if (!isBag(item) || depth > 8) return;
    const type = str(item.type);
    switch (type) {
      case 'component':
        builder.omit(
          'component',
          at,
          `The ${str(item.component) || 'catalog'} component is interactive and has no PPTX form.`
        );
        return;
      case 'heading': {
        const level = typeof item.level === 'number' ? item.level : 2;
        if (str(item.eyebrow)) paragraphs.push(para(str(item.eyebrow), 18, { bold: true }));
        paragraphs.push(heading(str(item.text), level <= 1 ? 44 : level === 2 ? 36 : 30));
        if (str(item.subtitle)) paragraphs.push(...textParagraphs(str(item.subtitle), 24));
        return;
      }
      case 'text':
        paragraphs.push(...textParagraphs(stripLightMarkdown(str(item.markdown)), 24, {}, 10));
        return;
      case 'list':
        for (const entry of list(item.items)) {
          const text = isBag(entry) ? str(entry.text) : str(entry);
          paragraphs.push({
            ...para(stripLightMarkdown(text), 24),
            bullet: !item.ordered,
            numbered: item.ordered === true,
            after: 6,
          });
        }
        return;
      case 'quote':
        paragraphs.push(
          ...textParagraphs(stripLightMarkdown(str(item.quote)), 30, { italic: true })
        );
        if (str(item.cite)) paragraphs.push(para(`— ${str(item.cite)}`, 20));
        return;
      case 'callout':
        if (str(item.title)) paragraphs.push(heading(str(item.title), 26));
        paragraphs.push(...textParagraphs(stripLightMarkdown(str(item.body)), 22));
        return;
      case 'code':
        if (str(item.caption)) paragraphs.push(para(str(item.caption), 18, { bold: true }));
        paragraphs.push(...textParagraphs(str(item.code), 18, { font: 'mono' }, 0));
        return;
      case 'divider':
        return;
      case 'columns':
        for (const [column, entry] of list(item.columns).entries()) {
          const blocks = isBag(entry) ? list(entry.blocks) : Array.isArray(entry) ? entry : [];
          walkFree(blocks, `${at}.columns[${column}]`, paragraphs, visuals, builder, depth + 1);
        }
        return;
      case 'table': {
        const rows = tableRowsFromBlock(item);
        if (rows) {
          if (str(item.caption)) paragraphs.push(para(str(item.caption), 20, { bold: true }));
          visuals.push({ kind: 'table', path: at, rows });
        } else builder.omit('block', at, 'The table has no columns.');
        return;
      }
      case 'image':
      case 'figure':
        visuals.push({
          kind: 'image',
          path: `${at}.src`,
          src: str(item.src),
          alt: item.decorative === true ? '' : str(item.alt),
          width: typeof item.width === 'number' ? item.width : undefined,
          height: typeof item.height === 'number' ? item.height : undefined,
        });
        if (str(item.caption)) paragraphs.push(para(str(item.caption), 18));
        return;
      case 'chart': {
        const { step: _step, fragment: _fragment, reveal: _reveal, tone: _tone, ...chart } = item;
        visuals.push({ kind: 'chart', path: at, chart });
        paragraphs.push(heading(str(item.title), 24));
        return;
      }
      case 'video':
      case 'audio':
      case 'gallery':
      case 'embed':
        builder.omit(
          type === 'gallery' ? 'image' : 'video',
          at,
          `A ${type} block is not embedded; only its text is kept.`
        );
        break;
      default:
        break;
    }
    let found = false;
    for (const key of ['title', 'label', 'text', 'body', 'caption', 'value'] as const) {
      const value = str(item[key]);
      if (value.trim()) {
        paragraphs.push(...textParagraphs(stripLightMarkdown(value), 22));
        found = true;
      }
    }
    for (const key of CONTAINER_KEYS) {
      if (Array.isArray(item[key])) {
        walkFree(item[key] as unknown[], `${at}.${key}`, paragraphs, visuals, builder, depth + 1);
        found = true;
      }
    }
    for (const [panel, entry] of list(item.panels).entries()) {
      if (isBag(entry) && Array.isArray(entry.blocks)) {
        if (str(entry.label)) paragraphs.push(heading(str(entry.label), 24));
        walkFree(
          entry.blocks,
          `${at}.panels[${panel}].blocks`,
          paragraphs,
          visuals,
          builder,
          depth + 1
        );
        found = true;
      }
    }
    for (const entry of list(item.items)) {
      if (!isBag(entry)) continue;
      const parts = ['title', 'body', 'text', 'label']
        .map((key) => str(entry[key]))
        .filter(Boolean);
      if (parts.length) {
        paragraphs.push({ ...para(parts.join(' — '), 22), bullet: true, after: 4 });
        found = true;
      }
    }
    if (!found && !['video', 'audio', 'gallery', 'embed'].includes(type)) {
      builder.omit('block', at, `A ${type || 'block'} block has no PPTX form.`);
    }
  });
}

async function freeSlide(builder: SlideBuilder, items: unknown[]): Promise<void> {
  const paragraphs: Paragraph[] = [];
  const visuals: Visual[] = [];
  walkFree(items, '$.blocks', paragraphs, visuals, builder);
  const content = builder.frame('body');
  const c = builder.c;
  const gap = Math.round(32 * c.u);
  const hasText = paragraphs.some((paragraph) => paragraph.runs.some((run) => run.text.trim()));
  let visualFrame = content;
  if (visuals.length > 0 && hasText) {
    const [text, side] = split(content, 2, gap, c.portrait) as [Frame, Frame];
    builder.box('Content', text, paragraphs, {
      autofit: true,
      placeholder: { type: 'body', idx: 1 },
    });
    visualFrame = side;
  } else if (hasText) {
    builder.placeholder('body', paragraphs);
  }
  if (visuals.length === 0) return;
  const frames = split(visualFrame, visuals.length, Math.round(16 * c.u), true);
  for (const [index, visual] of visuals.entries()) {
    const frame = frames[index] as Frame;
    if (visual.kind === 'table' && visual.rows) builder.tableShape(visual.rows, frame, 'Table');
    else if (visual.kind === 'chart' && visual.chart) {
      await builder.chart({ ...visual.chart, type: 'chart' }, visual.path, frame);
    } else if (visual.kind === 'image') {
      await builder.image(
        visual.src ?? '',
        visual.path,
        'image',
        frame,
        visual.alt ?? '',
        'contain',
        {
          size: { width: visual.width, height: visual.height },
        }
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The 20 catalog layouts

const CTR = 'ctr' as const;

function mediaBox(builder: SlideBuilder, frame: Frame, label: string): void {
  const fill = hexColor(builder.palette.foreground, '18181B');
  builder.box(
    'Video',
    frame,
    [para(label ? `▶ ${label}` : '▶', 24, { bold: true }, { align: CTR })],
    {
      fill,
      anchor: 'ctr',
      autofit: true,
    },
    { ...builder.text, color: inkOn(fill) }
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0] ?? '')
    .join('')
    .toUpperCase();
}

async function layoutSlide(builder: SlideBuilder, slide: DeckSlide): Promise<void> {
  const p = propsOf(slide);
  const c = builder.c;
  const gap = Math.round(24 * c.u);
  const title = pptxSlideTitle(slide);
  const at = (key: string) => `$.props.${key}`;
  switch (slide.layout) {
    case 'title-hero':
      builder.placeholder('title', [heading(str(p.title) || title, 64, CTR)], { anchor: 'b' });
      builder.placeholder('subtitle', [
        para(str(p.subtitle), 28, {}, { align: CTR, after: 12 }),
        para(str(p.meta), 20, {}, { align: CTR }),
      ]);
      return;
    case 'section-divider':
      builder.placeholder('eyebrow', [para(str(p.eyebrow), 22, { bold: true })], { anchor: 'b' });
      builder.placeholder('title', [heading(str(p.title) || title, 56)], { anchor: 't' });
      return;
    case 'closing-cta': {
      builder.placeholder('title', [heading(str(p.title) || title, 56, CTR)], { anchor: 'b' });
      builder.placeholder('text', [para(str(p.text), 26, {}, { align: CTR })]);
      const cta = isBag(p.cta) ? p.cta : {};
      const label = str(cta.label);
      if (label) {
        const fill = hexColor(builder.palette.primary, '2563EB');
        const w = Math.min(c.W - 2 * c.M, Math.round((label.length * 16 + 96) * c.u));
        builder.box(
          'Call to action',
          { x: (c.W - w) / 2, y: c.H * 0.62, w, h: Math.round(72 * c.u) },
          [para(label, 26, { bold: true }, { align: CTR })],
          {
            geometry: 'roundRect',
            fill,
            anchor: 'ctr',
          },
          { ...builder.text, color: inkOn(fill) }
        );
        const href = str(cta.href);
        if (href) {
          builder.box(
            'Link',
            {
              x: c.M,
              y: c.H * 0.62 + Math.round(84 * c.u),
              w: c.W - 2 * c.M,
              h: Math.round(40 * c.u),
            },
            [para(href, 18, {}, { align: CTR })]
          );
          builder.omit(
            'link',
            at('cta.href'),
            'The action link is written as text, not as a clickable link.'
          );
        }
      }
      builder.placeholder('footnote', [para(str(p.footnote), 16, {}, { align: CTR })]);
      return;
    }
    case 'two-column-split':
      builder.placeholder('title', [heading(title, 44)]);
      for (const side of ['left', 'right'] as const) {
        const column = isBag(p[side]) ? (p[side] as Bag) : {};
        builder.placeholder(side, [
          heading(str(column.heading), 28),
          ...textParagraphs(str(column.body), 22),
        ]);
      }
      return;
    case 'three-column-cards': {
      builder.placeholder('title', [heading(title, 44)]);
      list(p.cards)
        .slice(0, 3)
        .forEach((card, index) => {
          const bag = isBag(card) ? card : {};
          builder.placeholder(
            `card${index}`,
            [heading(str(bag.heading), 26), ...textParagraphs(str(bag.body), 20)],
            {
              geometry: 'roundRect',
              fill: hexColor(builder.palette.surface, 'F4F4F5'),
              line: hexColor(builder.palette.border, 'D4D4D8'),
              inset: Math.round(20 * c.u),
            }
          );
        });
      return;
    }
    case 'image-left':
    case 'image-right':
    case 'image-centered':
    case 'image-full-bleed': {
      const image = isBag(p.image) ? p.image : {};
      const full = slide.layout === 'image-full-bleed';
      const placed = await builder.image(
        str(image.src),
        at('image.src'),
        'image',
        builder.frame('media'),
        str(image.alt),
        slide.layout === 'image-centered' ? 'contain' : 'cover',
        {
          placeholder: PICTURE,
          size: {
            width: typeof image.width === 'number' ? image.width : undefined,
            height: typeof image.height === 'number' ? image.height : undefined,
          },
        }
      );
      if (full) {
        const overlay = str(p.overlay);
        if (overlay === 'dark' || overlay === 'light') {
          builder.box('Overlay', { x: 0, y: 0, w: c.W, h: c.H }, null, {
            fill: overlay === 'dark' ? '000000' : 'FFFFFF',
            fillAlpha: 0.45,
          });
        }
        const bandFill = overlay === 'light' ? 'FFFFFF' : '000000';
        const bandText = {
          fill: bandFill,
          fillAlpha: placed ? 0.6 : 1,
          inset: Math.round(16 * c.u),
        };
        const onBand = { ...builder.text, color: inkOn(bandFill) };
        const titleSpec = builder.frames.get('title');
        if (title && titleSpec) {
          builder.shapes.push(
            shape(builder.id(), 'Title', titleSpec.frame, [heading(title, 36)], onBand, {
              ...bandText,
              placeholder: TITLE,
            })
          );
        }
        const caption = [
          para(str(p.caption), 24, {}, { after: 4 }),
          para(str(p.credit), 16),
        ].filter((entry) => entry.runs[0]?.text);
        const captionSpec = builder.frames.get('caption');
        if (caption.length && captionSpec) {
          builder.shapes.push(
            shape(builder.id(), 'Caption', captionSpec.frame, caption, onBand, {
              ...bandText,
              placeholder: captionSpec.ph,
            })
          );
        }
        return;
      }
      builder.placeholder('title', [heading(title, 44)]);
      if (slide.layout === 'image-centered')
        builder.placeholder('caption', [para(str(p.caption), 20, {}, { align: CTR })]);
      else
        builder.placeholder(
          'text',
          [heading(str(p.heading), 30), ...textParagraphs(str(p.body), 22)],
          { anchor: 'ctr' }
        );
      return;
    }
    case 'video-left':
    case 'video-right':
    case 'video-centered': {
      const video = isBag(p.video) ? p.video : {};
      builder.placeholder('title', [heading(title, 44)]);
      const content = contentFrame(c);
      let frame: Frame;
      if (slide.layout === 'video-centered') {
        frame = { ...content, h: content.h - Math.round(76 * c.u) };
        builder.placeholder('caption', [para(str(p.caption), 20, {}, { align: CTR })]);
      } else {
        const [first, second] = split(content, 2, Math.round(32 * c.u), c.portrait) as [
          Frame,
          Frame,
        ];
        frame = slide.layout === 'video-left' || c.portrait ? first : second;
        builder.placeholder(
          'text',
          [heading(str(p.heading), 30), ...textParagraphs(str(p.body), 22)],
          { anchor: 'ctr' }
        );
      }
      mediaBox(builder, frame, str(video.label));
      builder.omit(
        'video',
        at('video.src'),
        'Video is not embedded; the slide shows a labelled frame.'
      );
      return;
    }
    case 'quote':
      builder.placeholder('title', title && title !== str(p.quote) ? [heading(title, 28)] : []);
      builder.placeholder(
        'quote',
        [para(`“${str(p.quote)}”`, 40, { italic: true, font: 'major' }, { align: CTR })],
        { anchor: 'ctr' }
      );
      builder.placeholder(
        'cite',
        str(p.cite) ? [para(`— ${str(p.cite)}`, 24, {}, { align: CTR })] : []
      );
      return;
    case 'code-with-callout': {
      const code = isBag(p.code) ? p.code : {};
      builder.placeholder('title', [heading(title, 44)]);
      const fill = hexColor(builder.palette.surface, 'F4F4F5');
      const spec = builder.frames.get('code');
      if (spec) {
        builder.shapes.push(
          shape(
            builder.id(),
            'Code',
            spec.frame,
            textParagraphs(str(code.source), 18, { font: 'mono' }, 0),
            builder.cardText,
            {
              placeholder: spec.ph,
              fill,
              line: hexColor(builder.palette.border, 'D4D4D8'),
              inset: Math.round(20 * c.u),
              autofit: true,
            }
          )
        );
      }
      builder.placeholder('side', [
        heading(str(p.heading), 28),
        ...list(p.bullets).map((bullet) => ({ ...para(str(bullet), 22), bullet: true, after: 8 })),
      ]);
      return;
    }
    case 'big-stat':
      builder.placeholder('title', title ? [heading(title, 28)] : []);
      builder.placeholder(
        'number',
        [para(str(p.number), 120, { bold: true, font: 'major' }, { align: CTR })],
        { anchor: 'b' }
      );
      builder.placeholder('label', [para(str(p.label), 32, {}, { align: CTR })]);
      builder.placeholder('context', [
        para(str(p.context), 22, {}, { align: CTR, after: 8 }),
        para(str(p.source) ? `Source: ${str(p.source)}` : '', 16, {}, { align: CTR }),
      ]);
      return;
    case 'comparison-table': {
      builder.placeholder('title', [heading(title, 44)]);
      const columns = list(p.columns).map(str);
      const cell = (value: unknown) => (value === true ? '✓' : value === false ? '—' : str(value));
      const rows = [
        ['', ...columns],
        ...list(p.rows).map((row) => {
          const bag = isBag(row) ? row : {};
          return [str(bag.label), ...list(bag.values).map(cell)];
        }),
      ];
      builder.tableShape(rows, contentFrame(c), 'Comparison table');
      return;
    }
    case 'process-steps': {
      builder.placeholder('title', [heading(title, 44)]);
      const steps = list(p.steps);
      split(contentFrame(c), steps.length, gap, c.portrait).forEach((frame, index) => {
        const step = isBag(steps[index]) ? (steps[index] as Bag) : {};
        builder.card(`Step ${index + 1}`, frame, [
          para(
            String(index + 1),
            36,
            { bold: true, font: 'major', color: hexColor(builder.palette.primary, '2563EB') },
            { after: 6 }
          ),
          heading(str(step.title), 24),
          ...textParagraphs(str(step.body), 18),
        ]);
      });
      return;
    }
    case 'timeline': {
      builder.placeholder('title', [heading(title, 44)]);
      const events = list(p.events);
      const content = contentFrame(c);
      const vertical = c.portrait;
      const frames = split(
        vertical
          ? content
          : {
              ...content,
              y: content.y + Math.round(48 * c.u),
              h: content.h - Math.round(48 * c.u),
            },
        events.length,
        Math.round(16 * c.u),
        vertical
      );
      if (!vertical) {
        builder.box(
          'Timeline',
          {
            x: content.x,
            y: content.y + Math.round(16 * c.u),
            w: content.w,
            h: Math.round(4 * c.u),
          },
          null,
          {
            fill: hexColor(builder.palette.border, 'D4D4D8'),
          }
        );
      }
      frames.forEach((frame, index) => {
        const event = isBag(events[index]) ? (events[index] as Bag) : {};
        if (!vertical) {
          const size = Math.round(20 * c.u);
          builder.box(
            'Marker',
            { x: frame.x, y: content.y + Math.round(8 * c.u), w: size, h: size },
            null,
            {
              geometry: 'ellipse',
              fill: hexColor(builder.palette.primary, '2563EB'),
            }
          );
        }
        builder.box(
          `Event ${index + 1}`,
          frame,
          [heading(str(event.time), 22), ...textParagraphs(str(event.text), 18)],
          { autofit: true }
        );
      });
      return;
    }
    case 'team-avatars': {
      builder.placeholder('title', [heading(title, 44)]);
      const people = list(p.people);
      const perRow = Math.min(people.length, c.portrait ? 2 : 4) || 1;
      const rows = split(contentFrame(c), Math.ceil(people.length / perRow), gap, true);
      for (const [index, person] of people.entries()) {
        const bag = isBag(person) ? person : {};
        const row = rows[Math.floor(index / perRow)] as Frame;
        const cell = split(row, perRow, gap, false)[index % perRow] as Frame;
        const size = Math.min(cell.w, cell.h * 0.55, 160 * c.u);
        const avatarFrame = { x: cell.x + (cell.w - size) / 2, y: cell.y, w: size, h: size };
        const name = str(bag.name);
        const avatar = str(bag.avatar);
        const placed = avatar
          ? await builder.image(
              avatar,
              `$.props.people[${index}].avatar`,
              'avatar',
              avatarFrame,
              name,
              'cover',
              { geometry: 'ellipse' }
            )
          : false;
        if (!placed) {
          const fill = hexColor(builder.palette.primary, '2563EB');
          builder.box(
            'Initials',
            avatarFrame,
            [para(initials(name), Math.round(size * 0.36), { bold: true }, { align: CTR })],
            {
              geometry: 'ellipse',
              fill,
              anchor: 'ctr',
            },
            { ...builder.text, color: inkOn(fill) }
          );
        }
        builder.box(
          `Person ${index + 1}`,
          {
            x: cell.x,
            y: cell.y + size + Math.round(12 * c.u),
            w: cell.w,
            h: cell.h - size - Math.round(12 * c.u),
          },
          [
            para(name, 22, { bold: true }, { align: CTR, after: 2 }),
            para(str(bag.role), 18, {}, { align: CTR }),
          ],
          { autofit: true }
        );
      }
      return;
    }
    case 'chart': {
      builder.placeholder('title', [heading(title, 44)]);
      const spec = isBag(p.spec) ? p.spec : {};
      const { step: _step, fragment: _fragment, reveal: _reveal, tone: _tone, ...chart } = spec;
      const placed = await builder.chart(
        { ...chart, type: 'chart' },
        at('spec'),
        builder.frame('media'),
        PICTURE
      );
      if (!placed) {
        builder.placeholder(
          'caption',
          [heading(str(spec.title), 30, CTR), para(str(spec.description), 22, {}, { align: CTR })],
          { anchor: 'ctr' }
        );
      }
      return;
    }
  }
}

async function buildSlide(state: PackageState, slide: DeckSlide): Promise<SlideBuilder> {
  const layout: DeckLayoutId = (DECK_LAYOUT_IDS as readonly string[]).includes(slide.layout)
    ? (slide.layout as DeckLayoutId)
    : 'free';
  const palette = paletteFor(state.deck, slide, state.options);
  const builder = new SlideBuilder(state, slide, layout, palette, '18181B');
  const ink = await paintBackground(builder, state.deck);
  builder.text.color = ink;
  const title = pptxSlideTitle(slide);
  if (slide.layout === 'free') {
    builder.placeholder('title', [heading(title, 44)]);
    await freeSlide(builder, list((slide as { blocks?: unknown }).blocks));
  } else if (slide.layout === 'component') {
    builder.placeholder('title', [heading(title, 44)]);
    const component = isBag((slide as { component?: unknown }).component)
      ? (slide as { component: Bag }).component
      : {};
    builder.omit(
      'component',
      '$.component',
      `The ${str(component.component) || 'catalog'} component is interactive and has no PPTX form.`
    );
  } else if (slide.layout === 'custom') {
    builder.placeholder('title', [heading(title, 44)]);
    builder.omit(
      'custom',
      '$.props.component',
      `The custom slide "${str(propsOf(slide).component)}" is painted by the host and has no PPTX form.`
    );
  } else {
    await layoutSlide(builder, slide);
  }
  return builder;
}

// ---------------------------------------------------------------------------
// Package parts

function layoutXml(id: DeckLayoutId, c: Canvas, style: TextStyle): XmlElement {
  const placeholders = layoutPlaceholders(id, c).map((spec, index) =>
    shape(
      index + 2,
      `${spec.name} Placeholder`,
      spec.frame,
      spec.ph.type === 'pic' ? null : [para('', 24)],
      style,
      {
        placeholder: spec.ph,
        autofit: true,
      }
    )
  );
  return el(
    'p:sldLayout',
    {
      'xmlns:a': NS.a,
      'xmlns:r': NS.r,
      'xmlns:p': NS.p,
      type: LAYOUT_TYPES[id] ?? 'cust',
      preserve: true,
    },
    el('p:cSld', { name: layoutLabel(id) }, shapeTree(...placeholders)),
    el('p:clrMapOvr', {}, el('a:masterClrMapping'))
  );
}

function notesTree(paragraphs: Paragraph[], style: TextStyle): XmlElement {
  return shapeTree(
    el(
      'p:sp',
      {},
      el(
        'p:nvSpPr',
        {},
        el('p:cNvPr', { id: 2, name: 'Slide Image Placeholder' }),
        el('p:cNvSpPr', {}, el('a:spLocks', { noGrp: true, noRot: true, noChangeAspect: true })),
        el('p:nvPr', {}, el('p:ph', { type: 'sldImg' }))
      ),
      el(
        'p:spPr',
        {},
        el(
          'a:xfrm',
          {},
          el('a:off', { x: 1_143_000, y: 685_800 }),
          el('a:ext', { cx: 4_572_000, cy: 3_429_000 })
        ),
        el('a:prstGeom', { prst: 'rect' }, el('a:avLst'))
      )
    ),
    shape(3, 'Notes Placeholder', { x: 72, y: 456, w: 576, h: 432 }, paragraphs, style, {
      placeholder: { type: 'body', idx: 1 },
      autofit: true,
    })
  );
}

function contentTypes(parts: readonly DeckPptxV2Part[], media: readonly MediaEntry[]): XmlElement {
  const defaults = new Map<string, string>([
    ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
    ['xml', 'application/xml'],
  ]);
  for (const entry of media) defaults.set(MIME_EXT[entry.mimeType], entry.mimeType);
  return el(
    'Types',
    { xmlns: NS.types },
    ...[...defaults].map(([Extension, ContentType]) => el('Default', { Extension, ContentType })),
    ...parts
      .filter((part) => part.contentType)
      .map((part) => el('Override', { PartName: `/${part.path}`, ContentType: part.contentType }))
  );
}

/**
 * Build the package for a validated v2 deck. Callbacks run one at a time in
 * slide order, so the same deck and the same host answers give the same bytes.
 */
export async function buildDeckPptxV2(
  deck: Deck,
  options: DeckPptxV2Options = {}
): Promise<DeckPptxV2Package> {
  const aspect: DeckAspect = deck.style?.aspect ?? '16:9';
  const canvas = canvasFor(aspect);
  const fonts = themeFonts(deck, options);
  const lang =
    typeof deck.meta.locale === 'string' && deck.meta.locale ? deck.meta.locale : 'en-US';
  const state: PackageState = {
    deck,
    options,
    canvas,
    lang,
    rtl: deck.meta.dir === 'rtl',
    mono: fonts.mono,
    media: [],
    mediaByKey: new Map(),
    budget: { used: 0 },
    omitted: [],
  };
  const withNotes = options.notes ?? true;
  const noteOmissions = options.noteOmissions ?? true;
  const deckPalette = paletteFor(deck, undefined, options);
  const baseStyle: TextStyle = {
    lang,
    rtl: state.rtl,
    color: hexColor(deckPalette.foreground, '18181B'),
    mono: fonts.mono,
  };
  const parts: DeckPptxV2Part[] = [];
  const add = (path: string, contentType: string | null, root: XmlElement) =>
    parts.push({ path, contentType, xml: serializeXml(root) });

  const visible =
    options.hidden === 'skip' ? deck.slides.filter((slide) => slide.hidden !== true) : deck.slides;
  const slides: SlideBuilder[] = [];
  for (const slide of visible) {
    const built = await buildSlide(state, slide);
    slides.push(built);
    state.omitted.push(...built.omitted);
  }
  const notesFor = slides.map((built) => {
    if (!withNotes) return null;
    const notes = typeof built.slide.notes === 'string' ? built.slide.notes.slice(0, MAX_TEXT) : '';
    const lines: Paragraph[] = notes ? textLines(notes).map((line) => para(line, 16)) : [];
    if (noteOmissions && built.omitted.length > 0) {
      if (lines.length) lines.push(para('', 16));
      lines.push(para('Not in this PPTX export:', 16, { bold: true }));
      for (const item of built.omitted)
        lines.push({ ...para(`${item.reason} (${item.path})`, 14), bullet: true });
    }
    return lines.length ? lines : null;
  });
  const hasNotes = notesFor.some(Boolean);

  // Package and presentation.
  add(
    '_rels/.rels',
    null,
    relationships([
      ['rId1', `${REL}/officeDocument`, 'ppt/presentation.xml'],
      [
        'rId2',
        'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
        'docProps/core.xml',
      ],
      ['rId3', `${REL}/extended-properties`, 'docProps/app.xml'],
    ])
  );
  add(
    'docProps/core.xml',
    'application/vnd.openxmlformats-package.core-properties+xml',
    el(
      'cp:coreProperties',
      {
        'xmlns:cp': 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:dcterms': 'http://purl.org/dc/terms/',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      },
      el('dc:title', {}, str(deck.meta.title)),
      deck.meta.description ? el('dc:description', {}, str(deck.meta.description)) : null,
      deck.meta.author ? el('dc:creator', {}, str(deck.meta.author)) : null,
      el('dc:language', {}, lang)
    )
  );
  add(
    'docProps/app.xml',
    'application/vnd.openxmlformats-officedocument.extended-properties+xml',
    el(
      'Properties',
      {
        xmlns: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
        'xmlns:vt': 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes',
      },
      el('Application', {}, 'Texuli'),
      el('Slides', {}, String(slides.length)),
      el('Notes', {}, String(notesFor.filter(Boolean).length))
    )
  );

  const rels: Relationship[] = [['rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml']];
  for (let index = 0; index < slides.length; index += 1) {
    rels.push([`rId${index + 2}`, `${REL}/slide`, `slides/slide${index + 1}.xml`]);
  }
  let next = slides.length + 2;
  const notesMasterId = `rId${next}`;
  if (hasNotes) {
    rels.push([notesMasterId, `${REL}/notesMaster`, 'notesMasters/notesMaster1.xml']);
    next += 1;
  }
  rels.push([`rId${next}`, `${REL}/presProps`, 'presProps.xml']);
  rels.push([`rId${next + 1}`, `${REL}/viewProps`, 'viewProps.xml']);
  rels.push([`rId${next + 2}`, `${REL}/theme`, 'theme/theme1.xml']);
  rels.push([`rId${next + 3}`, `${REL}/tableStyles`, 'tableStyles.xml']);
  const size = PPTX_CANVAS_SLIDE_SIZES[aspect];
  add(
    'ppt/presentation.xml',
    `${PML}.presentation.main+xml`,
    pml(
      'p:presentation',
      {},
      el('p:sldMasterIdLst', {}, el('p:sldMasterId', { id: 2_147_483_648, 'r:id': 'rId1' })),
      hasNotes
        ? el('p:notesMasterIdLst', {}, el('p:notesMasterId', { 'r:id': notesMasterId }))
        : null,
      slides.length > 0
        ? el(
            'p:sldIdLst',
            {},
            ...slides.map((_built, index) =>
              el('p:sldId', { id: 256 + index, 'r:id': `rId${index + 2}` })
            )
          )
        : null,
      el('p:sldSz', { cx: size.cx, cy: size.cy }),
      el('p:notesSz', { cx: 6_858_000, cy: 9_144_000 })
    )
  );
  add('ppt/_rels/presentation.xml.rels', null, relationships(rels));
  add('ppt/presProps.xml', `${PML}.presProps+xml`, pml('p:presentationPr', {}));
  add('ppt/viewProps.xml', `${PML}.viewProps+xml`, pml('p:viewPr', {}));
  add(
    'ppt/tableStyles.xml',
    `${PML}.tableStyles+xml`,
    el('a:tblStyleLst', { 'xmlns:a': NS.a, def: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}' })
  );

  // Theme, master and the 21 layouts.
  const themeColors = {
    dk1: hexColor(deckPalette.foreground, '18181B'),
    lt1: hexColor(deckPalette.background, 'FFFFFF'),
    dk2: hexColor(deckPalette.foreground, '18181B'),
    lt2: hexColor(deckPalette.surface, 'F4F4F5'),
    accent1: hexColor(deckPalette.primary, '2563EB'),
    accent2: hexColor(deckPalette.accent, '7C3AED'),
    accent3: hexColor(deckPalette.success, '15803D'),
    accent4: hexColor(deckPalette.warning, 'A16207'),
    accent5: hexColor(deckPalette.destructive, 'B91C1C'),
    accent6: hexColor(deckPalette.info, '0369A1'),
    hlink: hexColor(deckPalette.primary, '2563EB'),
    folHlink: hexColor(deckPalette.accent, '7C3AED'),
  };
  add(
    'ppt/theme/theme1.xml',
    'application/vnd.openxmlformats-officedocument.theme+xml',
    themeXml('Texuli', themeColors, fonts)
  );
  const layoutIds = DECK_LAYOUT_IDS as readonly DeckLayoutId[];
  const masterRels: Relationship[] = layoutIds.map((_id, index) => [
    `rId${index + 1}`,
    `${REL}/slideLayout`,
    `../slideLayouts/slideLayout${index + 1}.xml`,
  ]);
  masterRels.push([`rId${layoutIds.length + 1}`, `${REL}/theme`, '../theme/theme1.xml']);
  const masterTitle = titleFrame(canvas);
  add(
    'ppt/slideMasters/slideMaster1.xml',
    `${PML}.slideMaster+xml`,
    pml(
      'p:sldMaster',
      {},
      el(
        'p:cSld',
        {},
        el('p:bg', {}, el('p:bgRef', { idx: 1001 }, el('a:schemeClr', { val: 'bg1' }))),
        shapeTree(
          shape(2, 'Title Placeholder', masterTitle, [para('', 44)], baseStyle, {
            placeholder: TITLE,
            autofit: true,
          }),
          shape(3, 'Text Placeholder', contentFrame(canvas), [para('', 24)], baseStyle, {
            placeholder: body(1),
            autofit: true,
          })
        )
      ),
      el('p:clrMap', COLOR_MAP),
      el(
        'p:sldLayoutIdLst',
        {},
        ...layoutIds.map((_id, index) =>
          el('p:sldLayoutId', { id: 2_147_483_649 + index, 'r:id': `rId${index + 1}` })
        )
      ),
      textStyles()
    )
  );
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', null, relationships(masterRels));
  layoutIds.forEach((id, index) => {
    add(
      `ppt/slideLayouts/slideLayout${index + 1}.xml`,
      `${PML}.slideLayout+xml`,
      layoutXml(id, canvas, baseStyle)
    );
    add(
      `ppt/slideLayouts/_rels/slideLayout${index + 1}.xml.rels`,
      null,
      relationships([['rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml']])
    );
  });

  // Slides and notes.
  slides.forEach((built, index) => {
    const number = index + 1;
    const layoutIndex = layoutIds.indexOf(built.layout) + 1;
    const title = pptxSlideTitle(built.slide);
    add(
      `ppt/slides/slide${number}.xml`,
      `${PML}.slide+xml`,
      pml(
        'p:sld',
        { show: built.slide.hidden === true ? false : undefined },
        el('p:cSld', { name: title || `Slide ${number}` }, built.bg, shapeTree(...built.shapes)),
        el('p:clrMapOvr', {}, el('a:masterClrMapping'))
      )
    );
    const slideRels: Relationship[] = [
      ['rId1', `${REL}/slideLayout`, `../slideLayouts/slideLayout${layoutIndex}.xml`],
      ...built.rels,
    ];
    const notes = notesFor[index];
    if (notes)
      slideRels.push([
        `rId${slideRels.length + 1}`,
        `${REL}/notesSlide`,
        `../notesSlides/notesSlide${number}.xml`,
      ]);
    add(`ppt/slides/_rels/slide${number}.xml.rels`, null, relationships(slideRels));
    if (notes) {
      add(
        `ppt/notesSlides/notesSlide${number}.xml`,
        `${PML}.notesSlide+xml`,
        pml(
          'p:notes',
          {},
          el('p:cSld', {}, notesTree(notes, baseStyle)),
          el('p:clrMapOvr', {}, el('a:masterClrMapping'))
        )
      );
      add(
        `ppt/notesSlides/_rels/notesSlide${number}.xml.rels`,
        null,
        relationships([
          ['rId1', `${REL}/notesMaster`, '../notesMasters/notesMaster1.xml'],
          ['rId2', `${REL}/slide`, `../slides/slide${number}.xml`],
        ])
      );
    }
  });
  if (hasNotes) {
    add(
      'ppt/notesMasters/notesMaster1.xml',
      `${PML}.notesMaster+xml`,
      pml(
        'p:notesMaster',
        {},
        el('p:cSld', {}, notesTree([], baseStyle)),
        el('p:clrMap', COLOR_MAP)
      )
    );
    add(
      'ppt/notesMasters/_rels/notesMaster1.xml.rels',
      null,
      relationships([['rId1', `${REL}/theme`, '../theme/theme2.xml']])
    );
    add(
      'ppt/theme/theme2.xml',
      'application/vnd.openxmlformats-officedocument.theme+xml',
      themeXml('Texuli Notes', themeColors, fonts)
    );
  }

  parts.unshift({
    path: '[Content_Types].xml',
    contentType: null,
    xml: serializeXml(contentTypes(parts, state.media)),
  });
  return {
    filename: deckExportFilename(str(deck.meta.title) || 'deck', 'pptx'),
    parts,
    media: state.media.map((entry) => ({ ...entry })),
    omitted: state.omitted,
  };
}

/** Zip the package: `[Content_Types].xml` first, then every part and media file in build order. */
export async function writeDeckPptxV2(
  deck: Deck,
  options: DeckPptxV2Options = {}
): Promise<DeckPptxV2Written> {
  const built = await buildDeckPptxV2(deck, options);
  const bytes = writeZip([
    ...built.parts.map((part) => ({ path: part.path, data: part.xml })),
    ...built.media.map((entry) => ({ path: entry.path, data: entry.bytes })),
  ]);
  return { filename: built.filename, bytes, omitted: built.omitted };
}

/** The PPTX as a Blob for a host download; nothing is uploaded. */
export async function exportDeckPptxV2(
  deck: Deck,
  options: DeckPptxV2Options = {}
): Promise<DeckPptxV2Export> {
  const written = await writeDeckPptxV2(deck, options);
  return {
    filename: written.filename,
    blob: new Blob([written.bytes as BlobPart], { type: PPTX_MIME_TYPE }),
    omitted: written.omitted,
  };
}
