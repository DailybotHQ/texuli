import { contrastRatio, parseHex } from '@texuli/tokens/palette';

/**
 * Cohort retention tables without a framework: cell values, period
 * averages, display text and heat levels. Values are rates (0–1) or counts;
 * `null` marks a period a cohort has not reached yet.
 */

/** One cell: a value, `null` (not reached yet), or a value with an incomplete flag. */
export type CohortCell = number | null | { value: number | null; incomplete?: boolean };

/** One cohort: a row header, its size and one cell per period. */
export interface CohortRow {
  /** Stable key (default: the label). */
  id?: string;
  /** The row header, such as "Jan 2026". Plain text. */
  label: string;
  /** People in the cohort (the size column, and the weight of averages). */
  size?: number;
  cells: readonly CohortCell[];
}

/** What the cells hold: rates from 0 to 1 (default) or counts. */
export type CohortValueKind = 'rate' | 'count';

export interface CohortCellValue {
  value: number | null;
  incomplete: boolean;
}

/** A cell as `{ value, incomplete }` (non-finite numbers become `null`). */
export function cellValue(cell: CohortCell | undefined): CohortCellValue {
  const raw = typeof cell === 'object' && cell !== null ? cell : { value: cell ?? null };
  const value = typeof raw.value === 'number' && Number.isFinite(raw.value) ? raw.value : null;
  return { value, incomplete: Boolean('incomplete' in raw && raw.incomplete) };
}

/** Number of period columns: the longest row. */
export function periodCount(rows: readonly CohortRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
}

/**
 * The average of each period over the cohorts that reached it, weighted by
 * cohort size when every such cohort has one; `null` where none did.
 */
export function cohortAverages(rows: readonly CohortRow[]): (number | null)[] {
  return Array.from({ length: periodCount(rows) }, (_, period) => {
    const reached = rows
      .map((row) => ({ value: cellValue(row.cells[period]).value, size: row.size }))
      .filter(
        (entry): entry is { value: number; size: number | undefined } => entry.value !== null
      );
    if (reached.length === 0) return null;
    const weighted = reached.every((entry) => typeof entry.size === 'number' && entry.size > 0);
    let sum = 0;
    let weight = 0;
    for (const entry of reached) {
      const w = weighted ? (entry.size as number) : 1;
      sum += entry.value * w;
      weight += w;
    }
    return sum / weight;
  });
}

/** Default display text: a percent with one decimal for rates, a grouped integer for counts. */
export function formatCohortValue(
  value: number,
  kind: CohortValueKind = 'rate',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(
    locale,
    kind === 'rate' ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }
  ).format(value);
}

/** Heat levels: 0 is the faintest tint, `HEAT_LEVELS - 1` the solid fill. */
export const HEAT_LEVELS = 5;

/**
 * The heat level (0 to `levels - 1`, default 0 to 4) of a value against
 * `max` (a rate's max is 1). The built-in levels map to fixed tints so text
 * keeps its contrast on every one; a `heatScale` brings its own steps.
 */
export function heatLevel(value: number | null, max: number, levels = HEAT_LEVELS): number | null {
  if (value === null || !(max > 0) || !(levels >= 1)) return null;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.min(levels - 1, Math.floor(ratio * levels));
}

/**
 * Theme token pairs a heat step can name: the fill `--tx-<name>` with its
 * text `--tx-<name>-foreground`. The tokens' AA gate checks every one of
 * these pairs at 4.5:1 in every theme, so they keep the guarantee.
 */
export const COHORT_HEAT_TOKENS = [
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
  'primary-soft',
  'destructive-soft',
  'success-soft',
  'warning-soft',
  'info-soft',
] as const;
export type CohortHeatToken = (typeof COHORT_HEAT_TOKENS)[number];

/** Steps a `heatScale` may have. */
export const HEAT_SCALE_LIMITS = Object.freeze({ min: 2, max: 10 });
/** WCAG AA for the numbers in heat cells. */
export const HEAT_TEXT_MINIMUM = 4.5;

/** The two text colors a hex step chooses from (hex). */
export interface CohortHeatText {
  light: string;
  dark: string;
}
export const DEFAULT_HEAT_TEXT: Readonly<CohortHeatText> = Object.freeze({
  light: '#ffffff',
  dark: '#000000',
});

/** One resolved step: CSS colors for the fill and the text, and the measured ratio of a hex step. */
export interface CohortHeatStep {
  background: string;
  color: string;
  /** Contrast of a hex step with its text; `null` for a token pair (gated by the theme). */
  ratio: number | null;
}

export type CohortHeatScale = { ok: true; steps: CohortHeatStep[] } | { ok: false; error: string };

/**
 * Check a heat palette, lightest step first: each entry is a hex color
 * (`#rgb` or `#rrggbb`), whose text is the `light` or `dark` color with the
 * higher contrast, or a `COHORT_HEAT_TOKENS` name, painted with its gated
 * foreground. The palette is refused (`ok: false`, with the reason) when it
 * has fewer than 2 or more than 10 steps, an entry is neither, or a hex step
 * reaches less than 4.5:1 with its best text. With the default black and
 * white text, every hex color passes.
 */
export function resolveHeatScale(
  scale: readonly string[],
  text: CohortHeatText = DEFAULT_HEAT_TEXT
): CohortHeatScale {
  if (
    !Array.isArray(scale) ||
    scale.length < HEAT_SCALE_LIMITS.min ||
    scale.length > HEAT_SCALE_LIMITS.max
  ) {
    return {
      ok: false,
      error: `heatScale needs ${HEAT_SCALE_LIMITS.min} to ${HEAT_SCALE_LIMITS.max} steps.`,
    };
  }
  if (!parseHex(String(text.light)) || !parseHex(String(text.dark)))
    return { ok: false, error: 'heatText colors must be #rgb or #rrggbb.' };
  const steps: CohortHeatStep[] = [];
  for (const [index, entry] of scale.entries()) {
    const value = typeof entry === 'string' ? entry.trim() : '';
    if ((COHORT_HEAT_TOKENS as readonly string[]).includes(value)) {
      steps.push({
        background: `var(--tx-${value})`,
        color: `var(--tx-${value}-foreground)`,
        ratio: null,
      });
      continue;
    }
    if (!parseHex(value)) {
      return {
        ok: false,
        error: `heatScale step ${index + 1} ("${String(entry).slice(0, 40)}") is not a hex color or a heat token.`,
      };
    }
    const light = contrastRatio(text.light, value);
    const dark = contrastRatio(text.dark, value);
    const ratio = Math.max(light, dark);
    if (ratio < HEAT_TEXT_MINIMUM) {
      return {
        ok: false,
        error: `heatScale step ${index + 1} (${value}) reaches ${ratio.toFixed(2)}:1 with its text; ${HEAT_TEXT_MINIMUM}:1 is the minimum.`,
      };
    }
    steps.push({ background: value, color: light >= dark ? text.light : text.dark, ratio });
  }
  return { ok: true, steps };
}

/** The heat scale's top: 1 for rates, the largest cell for counts (period 0 skipped when asked). */
export function heatMax(
  rows: readonly CohortRow[],
  kind: CohortValueKind,
  skipFirst = false
): number {
  if (kind === 'rate') return 1;
  let max = 0;
  for (const row of rows) {
    row.cells.forEach((cell, period) => {
      const { value } = cellValue(cell);
      if ((!skipFirst || period > 0) && value !== null && value > max) max = value;
    });
  }
  return max;
}
