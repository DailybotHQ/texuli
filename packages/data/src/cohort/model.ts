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
 * The heat level (0 to 4) of a value against `max` (a rate's max is 1).
 * Levels map to fixed tints so text keeps its contrast on every one.
 */
export function heatLevel(value: number | null, max: number): number | null {
  if (value === null || !(max > 0)) return null;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.min(HEAT_LEVELS - 1, Math.floor(ratio * HEAT_LEVELS));
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
