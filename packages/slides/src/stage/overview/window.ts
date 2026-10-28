/**
 * Pure helpers for the overview grid: the column count for a container
 * width, the keyboard moves (grid pattern, right-to-left aware) and the
 * window of thumbnails mounted around the selection, so a long deck only
 * paints the slides near the one the presenter is looking at.
 */

/** Thumbnails mounted on each side of the selection. */
export const OVERVIEW_WINDOW_RADIUS = 12;

/** Column counts by minimum container width in CSS pixels, widest first. */
export const OVERVIEW_BREAKPOINTS: readonly { minWidth: number; columns: number }[] = [
  { minWidth: 1200, columns: 5 },
  { minWidth: 900, columns: 4 },
  { minWidth: 640, columns: 3 },
  { minWidth: 360, columns: 2 },
  { minWidth: 0, columns: 1 },
];

/** Columns for a container width (non-finite or negative widths get one column). */
export function overviewColumns(containerWidth: number): number {
  const width = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  return OVERVIEW_BREAKPOINTS.find((point) => width >= point.minWidth)?.columns ?? 1;
}

/** The keys the grid handles itself (Enter and Space activate the focused button). */
const MOVE_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

export function isOverviewMoveKey(key: string): boolean {
  return MOVE_KEYS.has(key);
}

/**
 * The selection after a key. Left and right step through the reading order
 * (flipped in right-to-left decks) and stop at the ends; up and down move a
 * row and stop at the first or last row; Home and End jump to the ends.
 * Unknown keys keep the selection.
 */
export function moveOverviewSelection(
  current: number,
  key: string,
  total: number,
  columns: number,
  dir: 'ltr' | 'rtl' | 'auto' = 'ltr'
): number {
  if (total <= 0) return 0;
  const cols = Math.max(1, Math.floor(columns) || 1);
  const index = Math.min(total - 1, Math.max(0, Math.trunc(current) || 0));
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  switch (key) {
    case forward:
      return Math.min(total - 1, index + 1);
    case backward:
      return Math.max(0, index - 1);
    case 'ArrowDown':
      return index + cols < total ? index + cols : index;
    case 'ArrowUp':
      return index - cols >= 0 ? index - cols : index;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return index;
  }
}

/** The half-open range `[start, end)` of positions mounted around `selected`. */
export function overviewWindow(
  selected: number,
  total: number,
  radius: number = OVERVIEW_WINDOW_RADIUS
): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 };
  const r = Math.max(0, Math.floor(radius) || 0);
  const index = Math.min(total - 1, Math.max(0, Math.trunc(selected) || 0));
  return { start: Math.max(0, index - r), end: Math.min(total, index + r + 1) };
}
