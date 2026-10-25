/** Shared finite-value and range helpers for compact chart components. */
import { minMaxBuckets } from '../math/downsample/min-max.ts';
import { extent } from '../math/scales/extent.ts';

export interface CompactChartLabels {
  tableSummary: string;
  measure: string;
  point: string;
  value: string;
  noData: string;
  current: string;
  minimum: string;
  maximum: string;
  target: string;
  range: string;
  complete: string;
  total: string;
  percent: string;
}

/** Declarative, JSON-safe formatting options shared by compact chart painters. */
export type ChartFormatSpec =
  | {
      type: 'number';
      locale?: string;
      style?: 'decimal' | 'percent' | 'currency';
      currency?: string;
      notation?: 'standard' | 'compact';
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    }
  | {
      type: 'date';
      locale?: string;
      timeZone?: string;
      dateStyle?: 'short' | 'medium' | 'long' | 'full';
      timeStyle?: 'short' | 'medium' | 'long' | 'full';
    };

export const COMPACT_CHART_LABELS: CompactChartLabels = {
  tableSummary: 'View data table',
  measure: 'Measure',
  point: 'Point',
  value: 'Value',
  noData: 'No data',
  current: 'Current',
  minimum: 'Minimum',
  maximum: 'Maximum',
  target: 'Target',
  range: 'Range',
  complete: 'Complete',
  total: 'Total',
  percent: 'Percent',
};

export function chartLabels(labels: Partial<CompactChartLabels> | undefined): CompactChartLabels {
  return { ...COMPACT_CHART_LABELS, ...labels };
}

export function finiteValues(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

export function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

export function describeValues(
  values: readonly (number | null)[],
  format: (value: number) => string,
  empty = 'No data'
) {
  const finite = finiteValues(values);
  if (!finite.length) return empty;
  const first = finite[0] as number;
  const last = finite.at(-1) as number;
  const direction = last > first ? 'increased' : last < first ? 'decreased' : 'stayed level';
  return `${finite.length} values; ${direction} from ${format(first)} to ${format(last)}.`;
}

const defaultNumberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatNumber(value: number): string {
  return defaultNumberFormat.format(value);
}

/** Most distinct format specs whose `Intl` formatters are kept; the oldest is dropped first. */
export const MAX_CACHED_FORMATTERS = 64;
const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

/**
 * One formatter per distinct spec: building an `Intl` formatter costs far
 * more than formatting with it, and a chart formats every value with the
 * same spec. A spec whose options `Intl` rejects is never cached.
 */
function formatterFor(spec: ChartFormatSpec): Intl.NumberFormat | Intl.DateTimeFormat {
  const key = JSON.stringify(spec);
  const cached = formatters.get(key);
  if (cached) return cached;
  let created: Intl.NumberFormat | Intl.DateTimeFormat;
  if (spec.type === 'date') {
    created = new Intl.DateTimeFormat(spec.locale, {
      ...(spec.timeZone === undefined ? {} : { timeZone: spec.timeZone }),
      ...(spec.dateStyle === undefined ? {} : { dateStyle: spec.dateStyle }),
      ...(spec.timeStyle === undefined ? {} : { timeStyle: spec.timeStyle }),
      ...(spec.dateStyle === undefined && spec.timeStyle === undefined
        ? { dateStyle: 'medium' as const }
        : {}),
    });
  } else {
    const digits = (candidate: number | undefined) =>
      Number.isInteger(candidate) && candidate !== undefined && candidate >= 0 && candidate <= 20
        ? candidate
        : undefined;
    const minimumFractionDigits = digits(spec.minimumFractionDigits);
    const maximumFractionDigits = digits(spec.maximumFractionDigits);
    created = new Intl.NumberFormat(spec.locale, {
      style: spec.style ?? 'decimal',
      ...(spec.currency === undefined ? {} : { currency: spec.currency }),
      notation: spec.notation ?? 'standard',
      ...(minimumFractionDigits === undefined ? {} : { minimumFractionDigits }),
      ...(maximumFractionDigits === undefined ? {} : { maximumFractionDigits }),
    });
  }
  if (formatters.size >= MAX_CACHED_FORMATTERS) {
    const oldest = formatters.keys().next().value;
    if (oldest !== undefined) formatters.delete(oldest);
  }
  formatters.set(key, created);
  return created;
}

/** Format a finite chart value from a plain-data spec; invalid options fall back safely. */
export function formatChartValue(value: number, spec?: ChartFormatSpec): string {
  if (!spec) return formatNumber(value);
  if (spec.type === 'date' && !Number.isFinite(value)) return formatNumber(value);
  try {
    return formatterFor(spec).format(value);
  } catch {
    return formatNumber(value);
  }
}

/** Most values a sparkline draws (plus the end marker); longer series draw min-max buckets. */
export const SPARKLINE_MAX_POINTS = 2_000;
/** Above this many values the sparkline data table renders a scroll window of rows. */
export const SPARKLINE_TABLE_WINDOW = 200;

export interface SparklinePoint {
  /** Index into the input values. */
  index: number;
  x: number;
  y: number | null;
  value: number | null;
}

export interface SparklineGeometry {
  points: SparklinePoint[];
  line: string;
  area: string;
  /** Position in `points` of the last drawable value, or -1. */
  last: number;
  baseline: number;
  barWidth: number;
}

/**
 * Sparkline geometry in a `width` × `height` viewBox. The value range is one
 * iterative scan, so a long series cannot overflow the stack. Past
 * SPARKLINE_MAX_POINTS values only min-max bucket samples are drawn (first,
 * lowest, highest and last per bucket, plus gaps), so the drawn shape keeps
 * every spike while the DOM stays bounded; the last drawable value is always
 * kept for the end marker.
 */
export function sparklineGeometry(
  values: readonly (number | null)[],
  variant: 'line' | 'area' | 'bar',
  height: number,
  width = 100
): SparklineGeometry {
  const finite = finiteValues(values);
  const includesZero = variant === 'bar';
  const range = extent(includesZero ? [...finite, 0] : finite);
  const min = range ? range[0] : 0;
  const max = range ? range[1] : 1;
  const y = (value: number) =>
    max === min ? height / 2 : 3 + ((max - value) / (max - min)) * (height - 6);
  const n = values.length;
  const value = (index: number): number | null => {
    const raw = values[index];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  };
  let lastFinite = n - 1;
  while (lastFinite >= 0 && value(lastFinite) === null) lastFinite--;
  let indices: number[];
  if (n > SPARKLINE_MAX_POINTS) {
    const xs = Float64Array.from({ length: n }, (_, i) => i);
    const ys = Float64Array.from({ length: n }, (_, i) => value(i) ?? Number.NaN);
    // Up to five samples per bucket: first, lowest, highest, last and one gap.
    indices = minMaxBuckets(xs, ys, { buckets: SPARKLINE_MAX_POINTS / 5 });
    if (lastFinite >= 0 && !indices.includes(lastFinite)) {
      indices.push(lastFinite);
      indices.sort((p, q) => p - q);
    }
  } else {
    indices = Array.from({ length: n }, (_, i) => i);
  }
  const points = indices.map((index) => {
    const v = value(index);
    return {
      index,
      x:
        n < 2
          ? width / 2
          : variant === 'bar'
            ? ((index + 0.5) * width) / n
            : (index * width) / (n - 1),
      y: v === null ? null : y(v),
      value: values[index] ?? null,
    };
  });
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point.y === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ x: point.x, y: point.y });
  }
  if (run.length) runs.push(run);
  const line = runs
    .map((segment) => segment.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(''))
    .join('');
  const area = runs
    .map(
      (segment) =>
        `${segment.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join('')}L${segment.at(-1)?.x},${height}L${segment[0]?.x},${height}Z`
    )
    .join('');
  const last = points.findLastIndex((point) => point.index === lastFinite);
  return {
    points,
    line,
    area,
    last,
    baseline: y(0),
    barWidth: values.length ? (width / values.length) * 0.7 : 0,
  };
}
