/**
 * Caps that keep every dashboard operation bounded on hostile input. A
 * layout from storage, a sync peer or an agent is clamped to these before
 * any packing runs, so the work is at most cubic in `widgets` (200) and
 * never depends on the numbers inside the layout.
 */
export const DASHBOARD_LIMITS = Object.freeze({
  /** Widgets in one layout; more are dropped. */
  widgets: 200,
  /** Columns in a grid. */
  columns: 24,
  /** Rows a widget may span. */
  height: 48,
  /** The last row a widget may start on. */
  rows: 4096,
  /** Characters in a widget or breakpoint id. */
  idLength: 64,
  /** Breakpoints in one dashboard. */
  breakpoints: 8,
  /** Bytes of serialized state `parseDashboard` reads. */
  stateBytes: 512 * 1024,
});

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** True for a widget or breakpoint id: letters, digits, `-` and `_`, at most 64 characters. */
export function isDashboardId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= DASHBOARD_LIMITS.idLength &&
    ID.test(value)
  );
}

/** A whole number within `[min, max]`; anything else (NaN, Infinity, text) is `fallback`. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Columns clamped to `1..DASHBOARD_LIMITS.columns` (12 when not a number). */
export function clampColumns(columns: unknown): number {
  return clampInt(columns, 1, DASHBOARD_LIMITS.columns, 12);
}
