import { type HrefTrust, safeImageSrc, safeImageSrcset } from '@texuli/core/url-policy';

/**
 * Framework-free image model (T-media-image): every URL the `Image` component
 * renders comes out of here, through the core image URL policy. Untrusted
 * sources (the default) allow HTTPS and relative paths only; developer trust
 * also allows HTTP, blob URLs and bounded base64 raster data images.
 */

export type ImageTrust = HrefTrust;
export type ImageFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
export type ImageLoading = 'lazy' | 'eager';
export type ImageFetchPriority = 'high' | 'low' | 'auto';

/** Builds one candidate URL for a target pixel width (an image CDN, for example). */
export type ImageLoader = (src: string, width: number) => string;

/** Point of interest in image coordinates, 0–1 from the top-left corner. */
export interface FocalPoint {
  x: number;
  y: number;
}

export type ImagePlaceholder =
  /** A solid color while loading (hex only: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`). */
  | { kind: 'color'; color: string }
  /** A tiny image shown blurred until the full image loads (blur-up). */
  | { kind: 'blur'; src: string };

export const IMAGE_LIMITS = Object.freeze({
  /** Generated srcset candidates. */
  widths: 16,
  /** Largest width or height accepted, in CSS pixels. */
  dimension: 16_384,
  /** Longest `sizes` value accepted. */
  sizes: 1_024,
});

export interface ImageSourceInput {
  src: unknown;
  srcset?: unknown;
  sizes?: unknown;
  /** Generate `srcset` from `src` at these widths with `loader` (when `srcset` is not given). */
  widths?: readonly number[];
  loader?: ImageLoader;
  trust?: ImageTrust;
}

export type ImageSourceIssue = 'src' | 'srcset' | 'sizes' | 'loader';

export interface ResolvedImageSources {
  /** The safe `src`, or `undefined` when the source is blocked. */
  src: string | undefined;
  srcset: string | undefined;
  sizes: string | undefined;
  /** Inputs that were present but dropped by the policy. */
  dropped: ImageSourceIssue[];
}

/** Safe, deduplicated, ascending widths within the limits. */
export function normalizeWidths(widths: readonly unknown[] | undefined): number[] {
  if (!Array.isArray(widths)) return [];
  const valid = new Set<number>();
  for (const width of widths) {
    if (Number.isSafeInteger(width) && (width as number) > 0) {
      valid.add(Math.min(width as number, IMAGE_LIMITS.dimension));
    }
  }
  return [...valid].sort((a, b) => a - b).slice(0, IMAGE_LIMITS.widths);
}

/**
 * Responsive `srcset` from a loader. Every generated URL must pass the image
 * policy, or the whole set is dropped (a half-safe srcset is not served).
 */
export function buildSrcset(
  src: string,
  widths: readonly number[],
  loader: ImageLoader,
  trust: ImageTrust = 'untrusted'
): string | undefined {
  const candidates: string[] = [];
  for (const width of normalizeWidths(widths)) {
    let url: unknown;
    try {
      url = loader(src, width);
    } catch {
      return undefined;
    }
    const safe = safeImageSrc(url, trust);
    if (!safe) return undefined;
    candidates.push(`${safe} ${width}w`);
  }
  return candidates.length > 0 ? safeImageSrcset(candidates.join(', '), trust) : undefined;
}

const SIZES_PATTERN = /^[a-z0-9\s(),.:%+\-/*]+$/i;

/** A `sizes` value made of media conditions and lengths only; anything else is dropped. */
export function safeSizes(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const sizes = value.trim().replace(/\s+/g, ' ');
  if (sizes === '' || sizes.length > IMAGE_LIMITS.sizes || !SIZES_PATTERN.test(sizes)) {
    return undefined;
  }
  return sizes;
}

/** Applies the image URL policy to `src`, `srcset` and `sizes`. */
export function resolveImageSources(input: ImageSourceInput): ResolvedImageSources {
  const trust = input.trust ?? 'untrusted';
  const dropped: ImageSourceIssue[] = [];
  const src = safeImageSrc(input.src, trust);
  if (!src) dropped.push('src');

  let srcset: string | undefined;
  if (input.srcset !== undefined && input.srcset !== '') {
    srcset = safeImageSrcset(input.srcset, trust);
    if (!srcset) dropped.push('srcset');
  } else if (src && input.loader && input.widths && input.widths.length > 0) {
    srcset = buildSrcset(src, input.widths, input.loader, trust);
    if (!srcset) dropped.push('loader');
  }

  let sizes: string | undefined;
  if (input.sizes !== undefined && input.sizes !== '') {
    sizes = safeSizes(input.sizes);
    if (!sizes) dropped.push('sizes');
  }
  // Without a srcset there is nothing for the browser to choose from.
  if (!src) return { src: undefined, srcset: undefined, sizes: undefined, dropped };
  return { src, srcset, sizes: srcset ? sizes : undefined, dropped };
}

function clampUnit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

/** Focal point clamped to 0–1; anything malformed falls back to the center. */
export function normalizeFocalPoint(point: unknown): FocalPoint {
  if (point === null || typeof point !== 'object') return { x: 0.5, y: 0.5 };
  const { x, y } = point as Record<string, unknown>;
  return { x: clampUnit(x, 0.5), y: clampUnit(y, 0.5) };
}

/**
 * CSS `object-position` for a focal point. Image coordinates are physical:
 * the picture is not mirrored in right-to-left layouts, so neither is this.
 */
export function focalPointPosition(point: unknown): string {
  const { x, y } = normalizeFocalPoint(point);
  const percent = (value: number) => `${Math.round(value * 10_000) / 100}%`;
  return `${percent(x)} ${percent(y)}`;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export type ResolvedPlaceholder =
  | { kind: 'color'; color: string }
  | { kind: 'blur'; src: string }
  | { kind: 'none' };

/** Validates a placeholder; a blur source goes through the same image policy. */
export function resolvePlaceholder(
  placeholder: unknown,
  trust: ImageTrust = 'untrusted'
): ResolvedPlaceholder {
  if (placeholder === null || typeof placeholder !== 'object') return { kind: 'none' };
  const record = placeholder as Record<string, unknown>;
  if (record.kind === 'color' && typeof record.color === 'string' && HEX_COLOR.test(record.color)) {
    return { kind: 'color', color: record.color };
  }
  if (record.kind === 'blur') {
    const src = safeImageSrc(record.src, trust);
    if (src) return { kind: 'blur', src };
  }
  return { kind: 'none' };
}

function dimension(value: unknown): number | undefined {
  return Number.isSafeInteger(value) &&
    (value as number) > 0 &&
    (value as number) <= IMAGE_LIMITS.dimension
    ? (value as number)
    : undefined;
}

/** Intrinsic width and height (reserve space, avoid layout shift), or nothing. */
export function intrinsicSize(
  width: unknown,
  height: unknown
): { width: number; height: number; ratio: string } | undefined {
  const w = dimension(width);
  const h = dimension(height);
  return w && h ? { width: w, height: h, ratio: `${w} / ${h}` } : undefined;
}

export const IMAGE_FITS: readonly ImageFit[] = ['cover', 'contain', 'fill', 'none', 'scale-down'];

export function normalizeFit(value: unknown): ImageFit {
  return (IMAGE_FITS as readonly unknown[]).includes(value) ? (value as ImageFit) : 'cover';
}
