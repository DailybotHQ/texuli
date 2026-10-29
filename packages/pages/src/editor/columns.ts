/**
 * Column widths: each column's share of 12. A resize moves share between
 * the two columns either side of a separator, one step per arrow key or per
 * twelfth of the row's width under the pointer. Framework-free.
 */
import type { ColumnBlock } from '@texuli/document/model';

/** The total share every row of columns splits. */
export const COLUMN_UNITS = 12;
/** The narrowest a column gets. */
export const MIN_COLUMN_WIDTH = 2;

/**
 * The widths a row renders with: the stored widths when they are whole
 * numbers from 1 to 12, the rest split evenly, and the last column absorbing
 * rounding so the sum is 12.
 */
export function columnWidths(columns: readonly Pick<ColumnBlock, 'width'>[]): number[] {
  const count = columns.length;
  if (count === 0) return [];
  const even = Math.floor(COLUMN_UNITS / count);
  const widths = columns.map((column) =>
    Number.isInteger(column.width) &&
    (column.width as number) >= 1 &&
    (column.width as number) <= 12
      ? (column.width as number)
      : even
  );
  const sum = widths.reduce((total, width) => total + width, 0);
  if (sum !== COLUMN_UNITS) {
    // Stored widths that do not add up are read as proportions.
    const scaled = widths.map((width) => Math.max(1, Math.round((width / sum) * COLUMN_UNITS)));
    const rest = COLUMN_UNITS - scaled.slice(0, -1).reduce((total, width) => total + width, 0);
    scaled[count - 1] = Math.max(1, rest);
    return scaled;
  }
  return widths;
}

/**
 * Move `steps` units across the separator after column `index` (positive
 * widens the column before it). Returns the new widths, or `null` when
 * nothing can move (a column would drop below `MIN_COLUMN_WIDTH`).
 */
export function resizeColumns(
  widths: readonly number[],
  index: number,
  steps: number
): number[] | null {
  const before = widths[index];
  const after = widths[index + 1];
  if (before === undefined || after === undefined || !Number.isInteger(steps) || steps === 0)
    return null;
  const clamped = Math.max(MIN_COLUMN_WIDTH - before, Math.min(after - MIN_COLUMN_WIDTH, steps));
  if (clamped === 0) return null;
  const next = [...widths];
  next[index] = before + clamped;
  next[index + 1] = after - clamped;
  return next;
}

/** Whole steps for a pointer travel of `delta` px across a row `rowSize` px wide. */
export function pointerSteps(delta: number, rowSize: number): number {
  if (!(rowSize > 0) || !Number.isFinite(delta)) return 0;
  return Math.trunc((delta / rowSize) * COLUMN_UNITS) || 0;
}
