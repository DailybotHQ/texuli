import type { CartesianPoint, CartesianSeries } from '../cartesian/model.ts';
import type { ChartPoint, ChartSeries } from '../math/types.ts';

/** Default retained point count per streaming series. */
export const DEFAULT_STREAM_MAX_POINTS = 10_000;
/** Hard ceiling for an individual immutable streaming buffer. */
export const MAX_STREAM_POINTS = 100_000;

export interface AppendSeriesWindowOptions {
  /** Retained tail size per series; defaults to `DEFAULT_STREAM_MAX_POINTS`. */
  maxPoints?: number;
}

/** One append-only batch for an existing numeric Cartesian series. */
export interface CartesianAppendBatch {
  seriesId: string;
  points: readonly CartesianPoint[];
}

function validateSeries(series: ChartSeries, label: string): void {
  if (!series || typeof series.id !== 'string' || series.id.trim() === '') {
    throw new TypeError(`${label} needs a non-empty series id.`);
  }
  if (typeof series.label !== 'string' || series.label.trim() === '') {
    throw new TypeError(`Series "${series.id}" needs a non-empty label.`);
  }
  if (!Array.isArray(series.points)) {
    throw new TypeError(`Series "${series.id}" needs a points array.`);
  }
  let previousX = Number.NEGATIVE_INFINITY;
  for (const [index, point] of series.points.entries()) {
    if (!point || !Number.isFinite(point.x) || (point.y !== null && !Number.isFinite(point.y))) {
      throw new TypeError(
        `Series "${series.id}" point ${index} must contain finite numeric values.`
      );
    }
    if (point.x <= previousX) {
      throw new RangeError(`Series "${series.id}" points must be strictly increasing by x.`);
    }
    previousX = point.x;
  }
}

/**
 * Append numeric, strictly increasing point batches and return a new bounded
 * tail window per existing series. Inputs are never mutated; batches for
 * unknown series and non-append order are rejected.
 */
export function appendSeriesWindow(
  current: readonly ChartSeries[],
  additions: readonly ChartSeries[],
  options: AppendSeriesWindowOptions = {}
): ChartSeries[] {
  if (!Array.isArray(current) || !Array.isArray(additions)) {
    throw new TypeError('Streaming updates require current and appended series arrays.');
  }
  const maxPoints = options.maxPoints ?? DEFAULT_STREAM_MAX_POINTS;
  if (!Number.isInteger(maxPoints) || maxPoints < 1 || maxPoints > MAX_STREAM_POINTS) {
    throw new RangeError(`maxPoints must be an integer from 1 to ${MAX_STREAM_POINTS}.`);
  }

  const currentById = new Map<string, ChartSeries>();
  for (const series of current) {
    validateSeries(series, 'Current series');
    if (currentById.has(series.id)) {
      throw new TypeError(`Duplicate current series id "${series.id}".`);
    }
    currentById.set(series.id, series);
  }

  const additionsById = new Map<string, ChartSeries>();
  for (const addition of additions) {
    validateSeries(addition, 'Appended series');
    if (additionsById.has(addition.id)) {
      throw new TypeError(`Duplicate appended series id "${addition.id}".`);
    }
    const base = currentById.get(addition.id);
    if (!base) throw new TypeError(`Cannot append points to unknown series "${addition.id}".`);
    if (base.label !== addition.label) {
      throw new TypeError(`Appended series "${addition.id}" must keep its existing label.`);
    }
    const lastX = base.points.at(-1)?.x;
    const firstX = addition.points[0]?.x;
    if (lastX !== undefined && firstX !== undefined && firstX <= lastX) {
      throw new RangeError(
        `Appended series "${addition.id}" must start strictly after its current tail.`
      );
    }
    additionsById.set(addition.id, addition);
  }

  return current.map((series) => {
    const addition = additionsById.get(series.id);
    if ((!addition || addition.points.length === 0) && series.points.length <= maxPoints) {
      return series;
    }
    const points: readonly ChartPoint[] = [...series.points, ...(addition?.points ?? [])];
    return { ...series, points: points.slice(-maxPoints) };
  });
}

/**
 * Apply append-only numeric batches to Cartesian data without mutating input.
 * Existing series metadata is preserved while the point tail remains bounded.
 */
export function appendCartesianSeriesWindow(
  current: readonly CartesianSeries[],
  additions: readonly CartesianAppendBatch[],
  options: AppendSeriesWindowOptions = {}
): CartesianSeries[] {
  if (!Array.isArray(current) || !Array.isArray(additions)) {
    throw new TypeError('Cartesian streaming updates require current and appended arrays.');
  }
  const currentById = new Map<string, CartesianSeries>();
  const base: ChartSeries[] = current.map((series) => {
    if (
      !series ||
      typeof series.id !== 'string' ||
      series.id.trim() === '' ||
      currentById.has(series.id)
    ) {
      throw new TypeError('Current Cartesian streaming series need unique ids.');
    }
    currentById.set(series.id, series);
    return {
      id: series.id,
      label: series.label,
      points: numericPoints(series.points, series.id),
    };
  });
  const batches: ChartSeries[] = additions.map((addition) => {
    if (!addition || typeof addition.seriesId !== 'string' || addition.seriesId.trim() === '') {
      throw new TypeError('Cartesian append batches need a non-empty seriesId.');
    }
    const source = currentById.get(addition.seriesId);
    if (!source) {
      throw new TypeError(`Cannot append points to unknown series "${addition.seriesId}".`);
    }
    return {
      id: addition.seriesId,
      label: source.label,
      points: numericPoints(addition.points, addition.seriesId),
    };
  });
  const bounded = appendSeriesWindow(base, batches, options);
  return bounded.map((series) => ({
    ...(currentById.get(series.id) as CartesianSeries),
    points: series.points,
  }));
}

function numericPoints(points: readonly CartesianPoint[], seriesId: string): ChartPoint[] {
  if (!Array.isArray(points)) {
    throw new TypeError(`Streaming series "${seriesId}" needs a points array.`);
  }
  return points.map((point, index) => {
    if (!point || typeof point.x !== 'number') {
      throw new TypeError(
        `Streaming series "${seriesId}" point ${index} must have numeric x values.`
      );
    }
    return { x: point.x, y: point.y };
  });
}
