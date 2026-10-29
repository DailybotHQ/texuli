/**
 * Page geometry (ADR-011): page sizes, orientation and margins resolved to
 * points (1/72 inch), the unit the PDF writer draws in. The DOCX writer
 * converts to twentieths of a point and the paged view to CSS pixels.
 */
import type { PageSettings, PageSize } from '../model/types.ts';

/** Points per millimetre. */
export const MM = 72 / 25.4;
/** CSS pixels per point (96 px per inch, 72 pt per inch). */
export const PX_PER_PT = 96 / 72;

/** Portrait page sizes in millimetres. */
export const PAGE_PRESETS: Readonly<
  Record<Exclude<PageSize, 'custom'>, { width: number; height: number }>
> = Object.freeze({
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
});

/** One inch on every side, in millimetres. */
export const DEFAULT_MARGINS = Object.freeze({
  top: 25.4,
  bottom: 25.4,
  inlineStart: 25.4,
  inlineEnd: 25.4,
});

/** A4 portrait with one-inch margins: the settings of a document without `page`. */
export const DEFAULT_PAGE_SETTINGS: Readonly<PageSettings> = Object.freeze({
  size: 'a4',
  orientation: 'portrait',
});

export interface PageMargins {
  top: number;
  bottom: number;
  inlineStart: number;
  inlineEnd: number;
}

/** A page resolved to points. */
export interface PageGeometry {
  size: PageSize;
  orientation: 'portrait' | 'landscape';
  /** The oriented page box, in points. */
  width: number;
  height: number;
  /** The oriented page box, in millimetres. */
  widthMm: number;
  heightMm: number;
  /** Margins in points. */
  margins: PageMargins;
  /** The content box (page minus margins), in points. */
  contentWidth: number;
  contentHeight: number;
}

const finite = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

/**
 * Resolve page settings to points. Total: unknown sizes fall back to A4,
 * values are clamped (sides 50 to 1,000 mm, margins 0 to 100 mm), and
 * margins never leave less than 10 mm of content.
 */
export function pageGeometry(settings?: Partial<PageSettings> | null): PageGeometry {
  const source = settings ?? DEFAULT_PAGE_SETTINGS;
  const size: PageSize =
    source.size === 'custom' ||
    (source.size !== undefined && Object.hasOwn(PAGE_PRESETS, source.size))
      ? source.size
      : 'a4';
  const preset = size === 'custom' ? null : PAGE_PRESETS[size];
  let widthMm = preset ? preset.width : finite(source.width, 210, 50, 1_000);
  let heightMm = preset ? preset.height : finite(source.height, 297, 50, 1_000);
  const orientation = source.orientation === 'landscape' ? 'landscape' : 'portrait';
  if ((orientation === 'landscape') !== widthMm > heightMm)
    [widthMm, heightMm] = [heightMm, widthMm];
  const m = source.margins ?? DEFAULT_MARGINS;
  let top = finite(m.top, DEFAULT_MARGINS.top, 0, 100);
  let bottom = finite(m.bottom, DEFAULT_MARGINS.bottom, 0, 100);
  let start = finite(m.inlineStart, DEFAULT_MARGINS.inlineStart, 0, 100);
  let end = finite(m.inlineEnd, DEFAULT_MARGINS.inlineEnd, 0, 100);
  // Keep at least 10 mm of content: shrink both margins of an axis evenly.
  const fit = (a: number, b: number, side: number): [number, number] => {
    const room = side - 10;
    if (a + b <= room) return [a, b];
    const scale = Math.max(0, room) / (a + b);
    return [a * scale, b * scale];
  };
  [top, bottom] = fit(top, bottom, heightMm);
  [start, end] = fit(start, end, widthMm);
  const margins = {
    top: top * MM,
    bottom: bottom * MM,
    inlineStart: start * MM,
    inlineEnd: end * MM,
  };
  const width = widthMm * MM;
  const height = heightMm * MM;
  return {
    size,
    orientation,
    width,
    height,
    widthMm,
    heightMm,
    margins,
    contentWidth: width - margins.inlineStart - margins.inlineEnd,
    contentHeight: height - margins.top - margins.bottom,
  };
}
