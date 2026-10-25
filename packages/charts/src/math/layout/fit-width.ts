/** The narrowest width a chart lays itself out at; below it the drawing scales down. */
export const MIN_CHART_WIDTH = 240;

/**
 * The width, in user units, a chart lays out at: its measured box, between
 * MIN_CHART_WIDTH and `preferred`. Laying out at the measured width keeps the
 * viewBox at the drawn size, so tick labels, margins and strokes stay at their
 * real pixel size on a phone instead of shrinking with the viewBox (11px ticks
 * drew at about 5px in a 288px column). Wider boxes keep `preferred` and scale
 * up as before. An unmeasured box (0, as during server rendering) uses
 * `preferred`.
 *
 * Not re-exported from the math index: it is component plumbing, and the math
 * subpath keeps its budget.
 */
export function fitChartWidth(measured: number | undefined, preferred: number): number {
  if (!measured || !Number.isFinite(measured) || measured <= 0) return preferred;
  return Math.round(Math.max(Math.min(MIN_CHART_WIDTH, preferred), Math.min(preferred, measured)));
}
