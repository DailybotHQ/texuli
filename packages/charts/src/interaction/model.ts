import { bisectX } from '../math/downsample/bisect.ts';

/*
 * Data contract and pure helpers for chart interaction: active point, keyboard
 * and pointer movement, series visibility, tooltip placement, zoom and brush.
 * Charts map data to pixel points and hand them to InteractivePlot.
 */

/** One point in pixel space plus values it shows. `y: null` is a gap (never focusable). */
export interface PlotPoint<D = unknown> {
  x: number;
  y: number | null;
  /** The x value (epoch ms, category…) for labels and the table. */
  xValue: number | string;
  /** The y value for labels and the table. */
  yValue: number | null;
  /** Optional point label used instead of the series label in exploration text. */
  label?: string;
  /** Complete accessible announcement override for synthetic explorer points. */
  accessibleLabel?: string;
  /** Optional per-point CSS color; falls back to the series theme color. */
  color?: string;
  datum?: D;
}

export interface PlotSeries<D = unknown> {
  id: string;
  label: string;
  /** CSS color; defaults to the series theme token. */
  color?: string;
  /** Exclude synthetic explorer-only points from pointer hit testing and tooltips. */
  pointer?: boolean;
  /** Sorted by x (or by the lookup axis). */
  points: readonly PlotPoint<D>[];
}

/** Visual mark used for a legend item; geometry stays independent of chart data. */
export type LegendSymbol =
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'cross'
  | 'line'
  | 'area'
  | 'bar';

/** Accessible label and visual mapping for a chart series or category legend item. */
export interface LegendItem {
  id: string;
  label: string;
  color?: string;
  symbol?: LegendSymbol;
}

export interface ChartFormatters {
  x: (value: number | string) => string;
  y: (value: number | null, seriesId: string) => string;
}

export type ChartCrosshair = 'x' | 'xy' | 'none';

export interface TooltipRow {
  id: string;
  label: string;
  color: string;
  value: string;
  current: boolean;
}

export interface TableWindow {
  start: number;
  end: number;
  top: number;
  bottom: number;
}

/** A bounded row range for the chart's accessible data-table viewport. */
export function tableWindow(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = 32,
  overscan = 4
): TableWindow {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const height = Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : 32;
  const visibleHeight = Math.max(0, Number.isFinite(viewportHeight) ? viewportHeight : 0);
  const offset = Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0);
  const extra = Number.isFinite(overscan) ? Math.max(0, Math.floor(overscan)) : 4;
  const firstVisible = Math.min(total, Math.floor(offset / height));
  const lastVisible = Math.min(total, Math.ceil((offset + visibleHeight) / height));
  const start = Math.max(0, firstVisible - extra);
  const end = Math.min(total, lastVisible + extra);
  return { start, end, top: start * height, bottom: (total - end) * height };
}

export interface ActivePoint {
  series: number;
  index: number;
}

export interface ChartSelection<D = unknown> {
  series: PlotSeries<D>;
  index: number;
  datum: D | undefined;
}

export interface Box {
  left: number;
  top: number;
}

export interface BrushRange {
  /** Pixel start along the brushed axis (unordered input is fine). */
  start: number;
  /** Pixel end along the brushed axis. */
  end: number;
}

export type DomainPair = readonly [number, number];

const defined = (p: PlotPoint | undefined) =>
  p !== undefined && p.y !== null && Number.isFinite(p.y);

/** Theme series color fallback (charts also accept an explicit `color`). */
export function seriesColor(index: number): string {
  const slot = (index % 8) + 1;
  return `var(--tx-chart-${slot}, var(--chart-${slot}, hsl(${(index * 47) % 360} 55% 45%)))`;
}

/** The next defined point from `index` in direction `step` (±1), or `index` when there is none. */
export function stepIndex(points: readonly PlotPoint[], index: number, step: 1 | -1): number {
  for (let i = index + step; i >= 0 && i < points.length; i += step) {
    if (defined(points[i])) return i;
  }
  return index;
}

/** First (`edge` = 1) or last (`edge` = -1) defined point, or -1. */
export function edgeIndex(points: readonly PlotPoint[], edge: 1 | -1): number {
  const start = edge === 1 ? -1 : points.length;
  const i = stepIndex(points, start, edge);
  return i === start ? -1 : i;
}

/** The defined point nearest to pixel `x`, or -1. */
export function nearestIndex(points: readonly PlotPoint[], x: number): number {
  const i = bisectX(points, x);
  if (i < 0) return -1;
  if (defined(points[i])) return i;
  const left = stepIndex(points, i, -1);
  const right = stepIndex(points, i, 1);
  const candidates = [left, right].filter((j) => j !== i && defined(points[j]));
  if (candidates.length === 0) return -1;
  return candidates.reduce((best, j) =>
    Math.abs((points[j] as PlotPoint).x - x) < Math.abs((points[best] as PlotPoint).x - x)
      ? j
      : best
  );
}

/** The visible point nearest to a two-dimensional pixel coordinate. */
export function nearestPoint2d(
  series: readonly PlotSeries[],
  hidden: ReadonlySet<string>,
  x: number,
  y: number
): ActivePoint | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let nearest: ActivePoint | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
    const item = series[seriesIndex];
    if (!item || item.pointer === false || hidden.has(item.id)) continue;
    for (let pointIndex = 0; pointIndex < item.points.length; pointIndex++) {
      const point = item.points[pointIndex];
      if (!point || point.y === null || !Number.isFinite(point.y)) continue;
      const dx = point.x - x;
      const dy = point.y - y;
      const candidate = dx * dx + dy * dy;
      if (candidate < distance) {
        distance = candidate;
        nearest = { series: seriesIndex, index: pointIndex };
      }
    }
  }
  return nearest;
}

/** Moves to the next visible series (`step` ±1), keeping the closest x. */
export function stepSeries(
  series: readonly PlotSeries[],
  hidden: ReadonlySet<string>,
  active: ActivePoint,
  step: 1 | -1
): ActivePoint {
  const x = series[active.series]?.points[active.index]?.x ?? 0;
  for (let s = active.series + step; s >= 0 && s < series.length; s += step) {
    const candidate = series[s] as PlotSeries;
    if (hidden.has(candidate.id)) continue;
    const index = nearestIndex(candidate.points, x);
    if (index >= 0) return { series: s, index };
  }
  return active;
}

/** The first visible series with a defined point, at its first point; null when nothing is plotted. */
export function firstActive(
  series: readonly PlotSeries[],
  hidden: ReadonlySet<string>
): ActivePoint | null {
  for (let s = 0; s < series.length; s++) {
    if (hidden.has((series[s] as PlotSeries).id)) continue;
    const index = edgeIndex((series[s] as PlotSeries).points, 1);
    if (index >= 0) return { series: s, index };
  }
  return null;
}

/** Toggles a series; refuses to hide the last visible one (returns the same set). */
export function toggleSeries(
  hidden: ReadonlySet<string>,
  id: string,
  ids: readonly string[]
): Set<string> {
  const next = new Set(hidden);
  if (next.has(id)) next.delete(id);
  else {
    const visible = ids.filter((other) => !next.has(other));
    if (visible.length <= 1 && visible.includes(id)) return new Set(hidden);
    next.add(id);
  }
  return next;
}

/**
 * Tooltip placement inside `bounds`: right of the anchor, flipped left at the
 * right edge; above it, flipped below at the top edge; then clamped.
 */
export function tooltipPosition(
  anchor: { x: number; y: number },
  size: { width: number; height: number },
  bounds: { width: number; height: number },
  offset = 12
): Box {
  let left = anchor.x + offset;
  if (left + size.width > bounds.width) left = anchor.x - offset - size.width;
  let top = anchor.y - offset - size.height;
  if (top < 0) top = anchor.y + offset;
  left = Math.max(0, Math.min(left, bounds.width - size.width));
  top = Math.max(0, Math.min(top, bounds.height - size.height));
  const covers =
    anchor.x >= left &&
    anchor.x <= left + size.width &&
    anchor.y >= top &&
    anchor.y <= top + size.height;
  if (covers) {
    const below = anchor.y + offset;
    top =
      below + size.height <= bounds.height ? below : Math.max(0, anchor.y - offset - size.height);
  }
  return { left, top };
}

/** Rows for the table fallback: one per distinct x, in order, with one cell per series. */
export function tableRows(
  series: readonly PlotSeries[]
): { xValue: number | string; cells: (number | null)[] }[] {
  const keys: (number | string)[] = [];
  const byKey = new Map<number | string, (number | null)[]>();
  series.forEach((s, k) => {
    for (const p of s.points) {
      let row = byKey.get(p.xValue);
      if (!row) {
        row = series.map(() => null);
        byKey.set(p.xValue, row);
        keys.push(p.xValue);
      }
      row[k] = p.yValue;
    }
  });
  const numeric = keys.every((k) => typeof k === 'number');
  if (numeric) (keys as number[]).sort((a, b) => a - b);
  return keys.map((xValue) => ({ xValue, cells: byKey.get(xValue) as (number | null)[] }));
}

/** Normalize a brush so start ≤ end. */
export function normalizeBrush(start: number, end: number): BrushRange {
  return start <= end ? { start, end } : { start: end, end: start };
}

/** Map a pixel brush through an invert scale to a domain pair (ordered). */
export function brushToDomain(brush: BrushRange, invert: (pixel: number) => number): DomainPair {
  const a = invert(brush.start);
  const b = invert(brush.end);
  return a <= b ? [a, b] : [b, a];
}

/** Keep a domain inside `full` and at least `minSpan` wide. */
export function clampZoomDomain(domain: DomainPair, full: DomainPair, minSpan = 0): DomainPair {
  const [f0, f1] = full;
  const fullSpan = f1 - f0;
  let start = Math.min(Math.max(domain[0], f0), f1);
  let end = Math.min(Math.max(domain[1], f0), f1);
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  let span = end - start;
  if (span < minSpan) {
    span = Math.min(minSpan, fullSpan);
    const mid = (start + end) / 2;
    start = mid - span / 2;
    end = mid + span / 2;
  }
  if (end > f1) {
    end = f1;
    start = end - span;
  }
  if (start < f0) {
    start = f0;
    end = start + span;
  }
  return [start, Math.min(end, f1)];
}

/**
 * Zoom a domain by `factor` (>1 zooms out, <1 zooms in) around `center`.
 * Result is clamped to `full`.
 */
export function zoomDomain(
  domain: DomainPair,
  factor: number,
  center: number,
  full: DomainPair,
  minSpan = 0
): DomainPair {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const span = (domain[1] - domain[0]) * safeFactor;
  const half = span / 2;
  return clampZoomDomain([center - half, center + half], full, minSpan);
}

/** True when reduced-motion is preferred (SSR-safe). */
export function prefersReducedMotion(
  query: { matches: boolean } | null | undefined = undefined
): boolean {
  if (query) return query.matches;
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
