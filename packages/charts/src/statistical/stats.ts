/*
 * Statistical summaries behind the box, violin and ECDF marks. Framework-free
 * and owned: quantiles (linear interpolation, the R-7 / spreadsheet default),
 * Tukey box summaries, Gaussian kernel density and the empirical CDF.
 *
 * Every function accepts untrusted input: non-finite values and magnitudes
 * past MAX_STAT_MAGNITUDE are dropped (so spans and interpolations stay
 * finite), the sample is capped at MAX_STAT_VALUES, and no step spreads an
 * array into a call, so a huge series cannot overflow the stack.
 */

/** Most values one summary reads; the rest are ignored and counted as dropped. */
export const MAX_STAT_VALUES = 100_000;
/** Largest magnitude kept; beyond it, `max - min` could overflow to Infinity. */
export const MAX_STAT_MAGNITUDE = 1e300;
/** Most points a density curve is sampled at. */
export const MAX_DENSITY_POINTS = 512;

export interface FiniteSample {
  /** Finite values, ascending. */
  sorted: number[];
  /** Inputs ignored: null, non-number, non-finite, too large or past the cap. */
  dropped: number;
}

/** Keep finite numbers within MAX_STAT_MAGNITUDE (up to MAX_STAT_VALUES inputs), ascending. */
export function finiteSample(values: readonly unknown[] | null | undefined): FiniteSample {
  if (!Array.isArray(values)) return { sorted: [], dropped: 0 };
  const limit = Math.min(values.length, MAX_STAT_VALUES);
  const kept = new Float64Array(limit);
  let n = 0;
  for (let i = 0; i < limit; i++) {
    const value: unknown = values[i];
    if (typeof value === 'number' && Math.abs(value) <= MAX_STAT_MAGNITUDE) kept[n++] = value;
  }
  // A typed-array sort is numeric and several times faster than a comparator sort.
  const sorted = Array.from(kept.subarray(0, n).sort());
  return { sorted, dropped: values.length - n };
}

/** Quantile `p` (0…1) of ascending values, linearly interpolated; `NaN` when empty. */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0 || !Number.isFinite(p)) return Number.NaN;
  const position = (n - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(position);
  const hi = Math.min(n - 1, lo + 1);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (position - lo);
}

export interface BoxSummary {
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** Most extreme values inside the fences (Tukey whiskers). */
  lowerWhisker: number;
  upperWhisker: number;
  /** Values outside `q1 - k·IQR … q3 + k·IQR`, ascending. */
  outliers: number[];
}

export interface BoxSummaryOptions {
  /** Fence multiplier `k` (default 1.5); `Infinity` draws whiskers to min and max. */
  whisker?: number;
}

/** Tukey five-number summary with whiskers and outliers; `null` for no finite values. */
export function boxSummary(
  values: readonly unknown[] | null | undefined,
  options: BoxSummaryOptions = {}
): BoxSummary | null {
  return boxSummarySorted(finiteSample(values).sorted, options);
}

/** `boxSummary` of values already passed through `finiteSample` (ascending, finite). */
export function boxSummarySorted(
  sorted: readonly number[],
  options: BoxSummaryOptions = {}
): BoxSummary | null {
  const n = sorted.length;
  if (n === 0) return null;
  const k = typeof options.whisker === 'number' && options.whisker >= 0 ? options.whisker : 1.5;
  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = k === Number.POSITIVE_INFINITY ? -Infinity : q1 - k * iqr;
  const highFence = k === Number.POSITIVE_INFINITY ? Infinity : q3 + k * iqr;
  let lowerWhisker = q1;
  let upperWhisker = q3;
  const outliers: number[] = [];
  for (const value of sorted) {
    if (value < lowFence || value > highFence) outliers.push(value);
    else {
      if (value < lowerWhisker) lowerWhisker = value;
      if (value > upperWhisker) upperWhisker = value;
    }
  }
  return {
    count: n,
    min: sorted[0] as number,
    q1,
    median,
    q3,
    max: sorted[n - 1] as number,
    lowerWhisker,
    upperWhisker,
    outliers,
  };
}

/** Silverman's rule-of-thumb bandwidth for a Gaussian kernel; 0 for fewer than two distinct values. */
export function silvermanBandwidth(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n < 2) return 0;
  let mean = 0;
  for (const value of sorted) mean += value / n;
  let variance = 0;
  for (const value of sorted) variance += (value - mean) ** 2 / (n - 1);
  const sd = Math.sqrt(variance);
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  const spread = Math.min(sd, iqr / 1.34) || sd || iqr;
  const bandwidth = 0.9 * spread * n ** -0.2;
  return Number.isFinite(bandwidth) ? bandwidth : 0;
}

export interface DensityPoint {
  x: number;
  density: number;
}

export interface KernelDensityOptions {
  /** Kernel bandwidth; default Silverman's rule. */
  bandwidth?: number;
  /** Sample points along the domain (2…MAX_DENSITY_POINTS, default 64). */
  points?: number;
  /** Fixed `[min, max]`; default the data extent padded by three bandwidths. */
  domain?: readonly [number, number];
}

const GAUSS = 1 / Math.sqrt(2 * Math.PI);
/** Smallest bandwidth used, so the kernel's normalizing factor stays finite. */
const MIN_BANDWIDTH = 1e-300;

/**
 * Gaussian kernel density estimate sampled at evenly spaced points. Returns
 * `[]` for no finite values; a single repeated value yields a narrow spike
 * whose bandwidth falls back to 1 % of its magnitude (or 1).
 */
export function kernelDensity(
  values: readonly unknown[] | null | undefined,
  options: KernelDensityOptions = {}
): DensityPoint[] {
  return kernelDensitySorted(finiteSample(values).sorted, options);
}

/** `kernelDensity` of values already passed through `finiteSample` (ascending, finite). */
export function kernelDensitySorted(
  sorted: readonly number[],
  options: KernelDensityOptions = {}
): DensityPoint[] {
  const n = sorted.length;
  if (n === 0) return [];
  const first = sorted[0] as number;
  const last = sorted[n - 1] as number;
  let bandwidth =
    typeof options.bandwidth === 'number' &&
    Number.isFinite(options.bandwidth) &&
    options.bandwidth > 0
      ? options.bandwidth
      : silvermanBandwidth(sorted);
  if (!(bandwidth > 0)) bandwidth = Math.abs(first) / 100 || 1;
  // A subnormal bandwidth would make 1 / (n · bandwidth) overflow to Infinity.
  bandwidth = Math.max(bandwidth, MIN_BANDWIDTH);
  const requested = Number.isFinite(options.points) ? Math.round(options.points as number) : 64;
  const count = Math.min(MAX_DENSITY_POINTS, Math.max(2, requested));
  let lo = first - 3 * bandwidth;
  let hi = last + 3 * bandwidth;
  const domain = options.domain;
  if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1])) {
    lo = Math.min(domain[0], domain[1]);
    hi = Math.max(domain[0], domain[1]);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const step = hi === lo ? 0 : (hi - lo) / (count - 1);
  const scale = GAUSS / (n * bandwidth);
  const out: DensityPoint[] = [];
  for (let i = 0; i < count; i++) {
    const x = lo + step * i;
    // Only values within six bandwidths contribute measurably; walk outward from x.
    let sum = 0;
    let start = lowerBound(sorted, x - 6 * bandwidth);
    for (; start < n; start++) {
      const value = sorted[start] as number;
      if (value > x + 6 * bandwidth) break;
      const u = (x - value) / bandwidth;
      sum += Math.exp(-0.5 * u * u);
    }
    out.push({ x, density: sum * scale });
  }
  return out;
}

/** First index whose value is `>= target` in ascending values. */
function lowerBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface EcdfStep {
  /** A distinct finite value. */
  x: number;
  /** Fraction of the sample `<= x`, 0…1. */
  p: number;
  /** Count of values `<= x`. */
  count: number;
}

/** Empirical cumulative distribution: one step per distinct value, ascending. */
export function ecdf(values: readonly unknown[] | null | undefined): EcdfStep[] {
  return ecdfSorted(finiteSample(values).sorted);
}

/** `ecdf` of values already passed through `finiteSample` (ascending, finite). */
export function ecdfSorted(sorted: readonly number[]): EcdfStep[] {
  const n = sorted.length;
  const steps: EcdfStep[] = [];
  for (let i = 0; i < n; i++) {
    const value = sorted[i] as number;
    if (i + 1 < n && sorted[i + 1] === value) continue;
    steps.push({ x: value, p: (i + 1) / n, count: i + 1 });
  }
  return steps;
}
