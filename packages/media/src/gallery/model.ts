import {
  type FocalPoint,
  type ImagePlaceholder,
  type ImageTrust,
  intrinsicSize,
  normalizeFocalPoint,
  resolveImageSources,
} from '../image/model.ts';

/**
 * Framework-free gallery model (T-media-gallery). Every source a gallery or
 * lightbox renders comes out of {@link resolveGalleryItems}, through the media
 * image URL policy: an item whose full source is blocked stays in the grid as
 * a labeled fallback, is never requested, and is skipped by the lightbox.
 */

export interface GalleryItem {
  /** Stable key; a missing or duplicate id falls back to the position. */
  id?: string;
  /** Full-size source shown in the lightbox (and in the tile without `thumbSrc`). */
  src: string;
  /** Required. Describes the image for the tile and the lightbox. */
  alt: string;
  srcset?: string;
  sizes?: string;
  /** Smaller source for the tile. When it is blocked the tile shows the fallback. */
  thumbSrc?: string;
  thumbSrcset?: string;
  /** Intrinsic size: the masonry layout and the lightbox use its ratio. */
  width?: number;
  height?: number;
  /** Visible caption under the tile (grid) or over it (masonry), and in the lightbox. */
  caption?: string;
  focalPoint?: FocalPoint;
  placeholder?: ImagePlaceholder;
}

export interface ResolvedGalleryItem {
  key: string;
  /** Position in the `items` input. */
  index: number;
  alt: string;
  caption: string | undefined;
  /** Policy-checked full source, or `undefined` when blocked. */
  src: string | undefined;
  srcset: string | undefined;
  sizes: string | undefined;
  /** Policy-checked tile source, or `undefined` when blocked. */
  thumbSrc: string | undefined;
  thumbSrcset: string | undefined;
  width: number | undefined;
  height: number | undefined;
  /** Height over width; 1 when the size is unknown. */
  ratio: number;
  focalPoint: FocalPoint | undefined;
  placeholder: ImagePlaceholder | undefined;
  /** The full source passed the policy, so the lightbox can show it. */
  viewable: boolean;
}

export const GALLERY_LIMITS = Object.freeze({
  /** Items rendered; the rest are ignored. */
  items: 500,
  /** Longest caption kept, in characters. */
  caption: 500,
  /** Columns a masonry gallery can have. */
  columns: 12,
  minZoom: 1,
  maxZoom: 4,
  /** Zoom change per button press or key. */
  zoomStep: 0.5,
  /** Shortest horizontal swipe, as a share of the stage width. */
  swipe: 0.15,
  /** A swipe needs at least this many pixels too. */
  swipeMin: 40,
});

export interface GalleryLabels {
  /** Name of the lightbox dialog. */
  title: string;
  previous: string;
  next: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  close: string;
  /** Position in the lightbox; `{current}` and `{total}` are replaced. */
  position: string;
  /** Tile button name for an image without alt text; `{current}` is replaced. */
  open: string;
  /** Visible fallback for a blocked or failed image. */
  unavailable: string;
}

export const DEFAULT_GALLERY_LABELS: Readonly<GalleryLabels> = Object.freeze({
  title: 'Image viewer',
  previous: 'Previous image',
  next: 'Next image',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  close: 'Close',
  position: '{current} of {total}',
  open: 'Open image {current}',
  unavailable: 'Image unavailable',
});

export function resolveGalleryLabels(labels?: Partial<GalleryLabels>): GalleryLabels {
  const out = { ...DEFAULT_GALLERY_LABELS };
  if (labels) {
    for (const key of Object.keys(out) as (keyof GalleryLabels)[]) {
      const value = labels[key];
      if (typeof value === 'string' && value.trim() !== '') out[key] = value;
    }
  }
  return out;
}

/** Replaces `{name}` tokens with numbers; unknown tokens stay as written. */
export function formatLabel(template: string, values: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token
  );
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Validates untrusted gallery items. It never throws: non-object entries are
 * skipped, unsafe sources are dropped by the image policy, and the list is
 * cut to {@link GALLERY_LIMITS.items}.
 */
export function resolveGalleryItems(
  items: unknown,
  trust: ImageTrust = 'untrusted'
): ResolvedGalleryItem[] {
  if (!Array.isArray(items)) return [];
  const out: ResolvedGalleryItem[] = [];
  const keys = new Set<string>();
  const count = Math.min(items.length, GALLERY_LIMITS.items);
  for (let index = 0; index < count; index++) {
    const raw: unknown = items[index];
    if (raw === null || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const full = resolveImageSources({
      src: item.src,
      srcset: item.srcset,
      sizes: item.sizes,
      trust,
    });
    const hasThumb = item.thumbSrc !== undefined && item.thumbSrc !== '';
    const thumb = hasThumb
      ? resolveImageSources({ src: item.thumbSrc, srcset: item.thumbSrcset, trust })
      : full;
    const size = intrinsicSize(item.width, item.height);
    const id = typeof item.id === 'string' && item.id !== '' ? item.id : undefined;
    let key = id && !keys.has(id) ? id : `item-${index}`;
    while (keys.has(key)) key = `${key}-${index}`;
    keys.add(key);
    out.push({
      key,
      index,
      alt: typeof item.alt === 'string' ? item.alt : '',
      caption: text(item.caption, GALLERY_LIMITS.caption),
      src: full.src,
      srcset: full.srcset,
      sizes: full.sizes,
      thumbSrc: thumb.src,
      thumbSrcset: thumb.srcset,
      width: size?.width,
      height: size?.height,
      ratio: size ? size.height / size.width : 1,
      focalPoint: item.focalPoint === undefined ? undefined : normalizeFocalPoint(item.focalPoint),
      placeholder: (item.placeholder as ImagePlaceholder | undefined) ?? undefined,
      viewable: full.src !== undefined,
    });
  }
  return out;
}

export interface MasonryPosition {
  column: number;
  /** Sum of the ratios above this item in its column (in column widths). */
  offset: number;
  /** Items above it in its column (each adds one gap). */
  above: number;
}

export interface MasonryLayout {
  columns: number;
  positions: MasonryPosition[];
  /** Per column: total ratio and item count, for the container height. */
  extents: { offset: number; count: number }[];
}

/**
 * Packs items into the shortest column, in order, so the visual order stays
 * close to the reading order (which is the DOM order). Ties go to the
 * inline-start column. Deterministic: the same ratios give the same layout.
 */
export function masonryLayout(ratios: readonly number[], columns: number): MasonryLayout {
  const count = clampColumns(columns);
  const extents = Array.from({ length: count }, () => ({ offset: 0, count: 0 }));
  const positions: MasonryPosition[] = [];
  for (const raw of ratios) {
    const ratio = Number.isFinite(raw) && raw > 0 ? raw : 1;
    let column = 0;
    let best = extents[0] as { offset: number; count: number };
    for (let c = 1; c < count; c++) {
      const candidate = extents[c] as { offset: number; count: number };
      // Shorter column first; on a tie, the one with fewer gaps.
      const tie = Math.abs(candidate.offset - best.offset) <= 1e-9;
      if ((!tie && candidate.offset < best.offset) || (tie && candidate.count < best.count)) {
        column = c;
        best = candidate;
      }
    }
    positions.push({ column, offset: best.offset, above: best.count });
    best.offset += ratio;
    best.count += 1;
  }
  return { columns: count, positions, extents };
}

export function clampColumns(columns: unknown): number {
  return Number.isFinite(columns)
    ? Math.min(GALLERY_LIMITS.columns, Math.max(1, Math.floor(columns as number)))
    : 3;
}

/** Columns that fit `width` at `minWidth` each with `gap` between, capped at `max`. */
export function columnCount(width: number, minWidth: number, gap: number, max: number): number {
  const limit = clampColumns(max);
  if (!(width > 0) || !(minWidth > 0)) return limit;
  const fit = Math.floor((width + Math.max(0, gap)) / (minWidth + Math.max(0, gap)));
  return Math.min(limit, Math.max(1, fit));
}

/**
 * The next viewable item from `from` in direction `delta` (±1), or `from`
 * when there is none. With `loop`, it wraps around the ends.
 */
export function stepViewable(
  items: readonly ResolvedGalleryItem[],
  from: number,
  delta: 1 | -1,
  loop = false
): number {
  const order = items.filter((item) => item.viewable).map((item) => item.index);
  if (order.length === 0) return from;
  const at = order.indexOf(from);
  if (at < 0) {
    const ahead =
      delta > 0 ? order.find((i) => i > from) : [...order].reverse().find((i) => i < from);
    return ahead ?? (loop ? (order[delta > 0 ? 0 : order.length - 1] as number) : from);
  }
  const next = at + delta;
  if (next >= 0 && next < order.length) return order[next] as number;
  return loop ? (order[(next + order.length) % order.length] as number) : from;
}

/** The first (`edge` = 'start') or last viewable item, or -1. */
export function edgeViewable(items: readonly ResolvedGalleryItem[], edge: 'start' | 'end'): number {
  const viewable = items.filter((item) => item.viewable);
  const item = edge === 'start' ? viewable[0] : viewable[viewable.length - 1];
  return item ? item.index : -1;
}

/** 1-based position among viewable items and their total. */
export function viewablePosition(
  items: readonly ResolvedGalleryItem[],
  index: number
): { current: number; total: number } {
  const order = items.filter((item) => item.viewable).map((item) => item.index);
  return { current: order.indexOf(index) + 1, total: order.length };
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return GALLERY_LIMITS.minZoom;
  return Math.min(GALLERY_LIMITS.maxZoom, Math.max(GALLERY_LIMITS.minZoom, zoom));
}

export interface Pan {
  x: number;
  y: number;
}

/** Keeps a zoomed image covering the stage: the pan cannot reveal its edges. */
export function clampPan(pan: Pan, zoom: number, stage: { width: number; height: number }): Pan {
  const z = clampZoom(zoom);
  const maxX = (Math.max(0, stage.width) * (z - 1)) / 2;
  const maxY = (Math.max(0, stage.height) * (z - 1)) / 2;
  const clamp = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(-max, value)) || 0 : 0;
  return { x: clamp(pan.x, maxX), y: clamp(pan.y, maxY) };
}

/**
 * A finished horizontal swipe: `next`, `previous` or nothing. It must be
 * mostly horizontal and long enough. Swiping toward the inline start shows
 * the next image, so in right-to-left layouts the direction flips.
 */
export function swipeIntent(
  dx: number,
  dy: number,
  width: number,
  rtl = false
): 'next' | 'previous' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const distance = Math.abs(dx);
  const threshold = Math.max(GALLERY_LIMITS.swipeMin, Math.max(0, width) * GALLERY_LIMITS.swipe);
  if (distance < threshold || distance < Math.abs(dy) * 1.5) return null;
  const towardLeft = dx < 0;
  return towardLeft !== rtl ? 'next' : 'previous';
}

const ASPECT = /^\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?)\s*)?$/;

/** A CSS `aspect-ratio` made of positive numbers only (`4 / 3`, `1.5`), or `1 / 1`. */
export function safeAspectRatio(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(value);
  if (typeof value !== 'string') return '1 / 1';
  const match = ASPECT.exec(value);
  if (!match) return '1 / 1';
  const width = Number(match[1]);
  const height = match[2] === undefined ? 1 : Number(match[2]);
  return width > 0 && height > 0 ? `${width} / ${height}` : '1 / 1';
}
