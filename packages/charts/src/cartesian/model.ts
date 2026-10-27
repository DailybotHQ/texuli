import type { PlotPoint as InteractionPlotPoint, PlotSeries } from '../interaction/model.ts';
import { extent, linearScale, stack } from '../math/index.ts';
import { type AreaPoint, areaPath, linePath } from '../math/shapes/line.ts';

export interface CartesianPoint {
  /** Category label, numeric x value, or epoch milliseconds for a time axis. */
  x: number | string;
  /** Null creates a visible gap in line and area charts and an empty table cell. */
  y: number | null;
}

export interface CartesianSeries {
  id: string;
  label: string;
  points: readonly CartesianPoint[];
  /** Optional CSS color. Prefer the `--tx-chart-*` theme tokens when omitted. */
  color?: string;
}

/** A numeric x-domain, inclusive at both ends. */
export type CartesianDomain = readonly [number, number];

export type CartesianKind = 'line' | 'area' | 'bar' | 'stacked-bar' | 'combo';

export interface PlotPoint {
  x: number;
  y: number | null;
}

export interface CartesianLayout {
  xKeys: (number | string)[];
  xPosition: (value: number | string) => number;
  yPosition: (value: number) => number;
  baseline: number;
  series: readonly CartesianSeries[];
  stacked: readonly (readonly (readonly [number, number])[])[];
}

const sameType = (values: readonly (number | string)[]) =>
  values.every((value) => typeof value === typeof values[0]);

/** Validate public chart input before rendering SVG geometry. */
export function assertCartesianSeries(series: readonly CartesianSeries[]): void {
  if (!Array.isArray(series)) throw new TypeError('Cartesian charts need a series array.');
  const ids = new Set<string>();
  for (const [seriesIndex, item] of series.entries()) {
    if (!item || typeof item.id !== 'string' || item.id.trim() === '') {
      throw new TypeError(`Series ${seriesIndex} needs a non-empty id.`);
    }
    if (ids.has(item.id)) throw new TypeError(`Duplicate series id "${item.id}".`);
    ids.add(item.id);
    if (typeof item.label !== 'string' || item.label.trim() === '') {
      throw new TypeError(`Series "${item.id}" needs a non-empty label.`);
    }
    if (!Array.isArray(item.points)) throw new TypeError(`Series "${item.id}" needs points.`);
    const points: readonly CartesianPoint[] = item.points;
    const xs = points.map((point) => point.x);
    if (!sameType(xs))
      throw new TypeError(`Series "${item.id}" cannot mix category and numeric x values.`);
    const seenX = new Set<number | string>();
    for (const [pointIndex, point] of item.points.entries()) {
      if (
        (typeof point.x !== 'string' && !Number.isFinite(point.x)) ||
        (typeof point.x === 'string' && point.x.length === 0) ||
        (point.y !== null && !Number.isFinite(point.y))
      ) {
        throw new TypeError(`Series "${item.id}" point ${pointIndex} must contain finite values.`);
      }
      if (seenX.has(point.x)) {
        throw new TypeError(
          `Series "${item.id}" has a duplicate x value ${JSON.stringify(point.x)} at point ${pointIndex}; aggregate repeated measurements before charting them.`
        );
      }
      seenX.add(point.x);
    }
  }
  const kinds = new Set(
    series.flatMap((item) =>
      (item.points as readonly CartesianPoint[]).map((point) => typeof point.x)
    )
  );
  if (kinds.size > 1)
    throw new TypeError('Cartesian charts cannot mix category and numeric x values.');
}

/** Stable union of x values in input order; numeric points sort ascending. */
export function xDomain(series: readonly CartesianSeries[]): (number | string)[] {
  const values = [...new Set(series.flatMap((item) => item.points.map((point) => point.x)))];
  return typeof values[0] === 'number' ? values.sort((a, b) => Number(a) - Number(b)) : values;
}

/**
 * Keep the points intersecting a numeric view and one neighbor at each edge.
 * The neighbors preserve line continuity when the visible range cuts between samples.
 */
export function windowCartesianSeries(
  series: readonly CartesianSeries[],
  domain: CartesianDomain
): CartesianSeries[] {
  const [start, end] = domain;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new RangeError('A visible chart domain must contain finite ascending bounds.');
  }

  return series.map((item) => {
    if (item.points.some((point) => typeof point.x !== 'number')) {
      throw new TypeError('A visible numeric domain requires numeric x values.');
    }
    const inside: CartesianPoint[] = [];
    let before: CartesianPoint | undefined;
    let after: CartesianPoint | undefined;
    let previousX = Number.NEGATIVE_INFINITY;
    let isSorted = true;

    for (const point of item.points) {
      const x = Number(point.x);
      if (x < previousX) isSorted = false;
      previousX = x;
      if (x < start && (!before || x > Number(before.x))) before = point;
      else if (x > end && (!after || x < Number(after.x))) after = point;
      else if (x >= start && x <= end) inside.push(point);
    }

    // If the viewport falls between samples, keep its bracketing pair. With
    // samples in-range, keep one nearest neighbor on either side instead.
    const points =
      inside.length === 0
        ? before && after
          ? [before, after]
          : []
        : [...(before ? [before] : []), ...inside, ...(after ? [after] : [])];
    if (!isSorted) points.sort((a, b) => Number(a.x) - Number(b.x));
    return { ...item, points };
  });
}

/** Build scaled coordinates for line and area plots. */
export function createCartesianLayout(
  series: readonly CartesianSeries[],
  width = 640,
  height = 320,
  stacked = false
): CartesianLayout {
  assertCartesianSeries(series);
  const left = 54;
  const right = width - 16;
  const top = 16;
  const bottom = height - 42;
  const xKeys = xDomain(series);
  const numericX = xKeys.every((value) => typeof value === 'number');
  const xValues = numericX ? (xKeys as number[]) : xKeys.map((_, index) => index);
  const xExtent = extent(xValues) ?? [0, 1];
  const xScale = linearScale({ domain: xExtent, range: [left, right], nice: false });
  const pointX = (value: number | string) => {
    if (numericX) return xScale(Number(value));
    const index = xKeys.indexOf(value);
    return xKeys.length <= 1
      ? (left + right) / 2
      : left + (index / (xKeys.length - 1)) * (right - left);
  };
  const matrix = series.map((item) => {
    const byX = new Map(item.points.map((point) => [point.x, point.y]));
    return xKeys.map((key) => byX.get(key) ?? null);
  });
  const stacks = stacked
    ? stack(matrix, { offset: 'diverging' })
    : matrix.map((row) => row.map((value) => [0, value ?? 0] as const));
  const yValues = stacked
    ? stacks.flat().flat()
    : matrix.flat().filter((value): value is number => value !== null);
  const yExtent = extent(yValues) ?? [0, 1];
  const yScale = linearScale({
    domain: yExtent[0] === yExtent[1] ? [Math.min(0, yExtent[0]), yExtent[1] || 1] : yExtent,
    range: [bottom, top],
    nice: true,
  });
  const baseline = yScale(Math.min(yScale.domain[1], Math.max(yScale.domain[0], 0)));
  return {
    xKeys,
    xPosition: pointX,
    yPosition: yScale,
    baseline,
    series,
    stacked: stacks,
  };
}

/**
 * Map cartesian series into pixel-space plot series for InteractivePlot.
 * `y` is the drawable anchor (line value or top of bar segment).
 */
export function toInteractionSeries(
  series: readonly CartesianSeries[],
  options: {
    keys: readonly (number | string)[];
    xPosition: (key: number | string) => number;
    yPosition: (value: number) => number;
    stackSpans: readonly (readonly (readonly [number, number])[])[];
    kind: CartesianKind;
  }
): PlotSeries[] {
  const { keys, xPosition, yPosition, stackSpans, kind } = options;
  return series.map((item, seriesIndex) => {
    const byX = new Map(item.points.map((point) => [point.x, point.y]));
    const points: InteractionPlotPoint[] = keys.map((key, index) => {
      const yValue = byX.get(key) ?? null;
      const x = xPosition(key);
      if (yValue === null) {
        return { x, y: null, xValue: key, yValue: null };
      }
      const span = stackSpans[seriesIndex]?.[index] ?? ([0, yValue] as const);
      const isBar =
        kind === 'bar' || kind === 'stacked-bar' || (kind === 'combo' && seriesIndex === 0);
      const yTop = yPosition(span[1]);
      const yBottom = yPosition(span[0]);
      const y = isBar ? (yTop + yBottom) / 2 : yTop;
      return { x, y, xValue: key, yValue };
    });
    return {
      id: item.id,
      label: item.label,
      color: item.color ?? `var(--chart-${(seriesIndex % 8) + 1})`,
      points,
    };
  });
}

/** Build SVG paths for a line or area series, including null gaps. */
export function lineCoordinates(
  layout: CartesianLayout,
  seriesIndex: number,
  filled = false
): { line: string; area: string } {
  const item = layout.series[seriesIndex];
  if (!item) return { line: '', area: '' };
  const points = item.points.map((point): AreaPoint => {
    const x = layout.xPosition(point.x);
    if (!layout.stacked[seriesIndex]) return { x, y0: layout.baseline, y1: point.y };
    const index = layout.xKeys.indexOf(point.x);
    const span = layout.stacked[seriesIndex]?.[index];
    return {
      x,
      y0: span ? layout.yPosition(span[0]) : layout.baseline,
      y1: point.y === null || !span ? null : layout.yPosition(span[1]),
    };
  });
  return {
    line: linePath(points.map(({ x, y1 }) => ({ x, y: y1 }))),
    area: filled ? areaPath(points) : '',
  };
}
