/**
 * Pure helpers for Rating (T-ui-rating): value normalization, star fill and
 * translatable label templates. No DOM.
 */

export const RATING_MAX_LIMIT = 10;

/** Star count clamped to 1–10 (default 5). */
export function normalizeMax(max: unknown): number {
  return typeof max === 'number' && Number.isFinite(max)
    ? Math.min(RATING_MAX_LIMIT, Math.max(1, Math.floor(max)))
    : 5;
}

/**
 * An input value on the allowed grid: whole stars, or halves with
 * `allowHalf`; 0 means "not rated". Out-of-range values clamp.
 */
export function normalizeValue(value: unknown, max: number, allowHalf: boolean): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  const grid = allowHalf ? 2 : 1;
  return Math.min(max, Math.round(value * grid) / grid);
}

/** A display value: any fraction (an average like 4.3), clamped to 0–max. */
export function clampDisplay(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

/** How much of star `index` (1-based) is filled, 0–1. */
export function starFill(value: number, index: number): number {
  return Math.min(1, Math.max(0, value - (index - 1)));
}

/** The values the radios represent, ascending (halves with `allowHalf`). */
export function ratingSteps(max: number, allowHalf: boolean): number[] {
  const step = allowHalf ? 0.5 : 1;
  return Array.from({ length: max / step }, (_, i) => (i + 1) * step);
}

export interface RatingLabels {
  /** Accessible and visible group label. */
  label: string;
  /** Each radio: `{value}` and `{max}`. */
  item: string;
  /** The visible summary: `{value}` and `{max}`. */
  summary: string;
  /** The summary when nothing is selected. */
  none: string;
  /** Display mode's accessible name: `{value}` and `{max}`. */
  display: string;
}

export const DEFAULT_RATING_LABELS: Readonly<RatingLabels> = Object.freeze({
  label: 'Rating',
  item: '{value} of {max} stars',
  summary: '{value} of {max}',
  none: 'Not rated',
  display: 'Rated {value} out of {max}',
});

/** Fills `{name}` placeholders; numbers are formatted for `locale`. */
export function formatRatingLabel(
  template: string,
  values: Record<string, number>,
  locale?: string
): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? format.format(values[name] as number) : match
  );
}
