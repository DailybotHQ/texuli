import { bandScale, linearScale, niceDomain, roundCoord, ticks } from '../math/index.ts';
import {
  type BoxSummary,
  boxSummarySorted,
  type DensityPoint,
  type EcdfStep,
  ecdfSorted,
  finiteSample,
  kernelDensitySorted,
} from './stats.ts';

/*
 * SVG layouts for the statistical marks. Each layout is pure: it reads the
 * owned summaries in stats.ts and returns rounded coordinates, so the Svelte
 * components only draw. Groups and series are capped and de-duplicated by id
 * because the data may come from an agent.
 */

/** Most groups (box, violin) or series (ECDF) one chart draws. */
export const MAX_STAT_GROUPS = 24;
/** Most outlier dots one box draws; the summary still holds every outlier. */
export const MAX_DRAWN_OUTLIERS = 200;

export interface StatGroup {
  id: string;
  label: string;
  values: readonly (number | null)[];
}

export interface StatTableLabels {
  table: string;
  group: string;
  count: string;
  min: string;
  q1: string;
  median: string;
  q3: string;
  max: string;
  value: string;
  cumulative: string;
}

export const STAT_TABLE_LABELS: StatTableLabels = {
  table: 'View data table',
  group: 'Group',
  count: 'Count',
  min: 'Minimum',
  q1: 'First quartile',
  median: 'Median',
  q3: 'Third quartile',
  max: 'Maximum',
  value: 'Value',
  cumulative: 'Cumulative share',
};

export function statLabels(labels: Partial<StatTableLabels> | undefined): StatTableLabels {
  return { ...STAT_TABLE_LABELS, ...labels };
}

export interface StatLayoutOptions {
  width?: number;
  height?: number;
  /** Fixed value domain; default the data extent rounded to nice ticks. */
  domain?: readonly [number, number];
}

export interface StatTick {
  value: number;
  /** Pixel position along the value axis. */
  position: number;
}

const MARGIN = { top: 16, right: 16, bottom: 36, left: 48 };

function size(options: StatLayoutOptions) {
  const width = Number.isFinite(options.width) ? Math.max(160, options.width as number) : 640;
  const height = Number.isFinite(options.height) ? Math.max(120, options.height as number) : 320;
  return { width, height };
}

/** Keep the first group per non-empty id, up to MAX_STAT_GROUPS. */
export function normalizeGroups(groups: readonly StatGroup[] | null | undefined): StatGroup[] {
  if (!Array.isArray(groups)) return [];
  const seen = new Set<string>();
  const out: StatGroup[] = [];
  for (const group of groups) {
    if (out.length >= MAX_STAT_GROUPS) break;
    if (group === null || typeof group !== 'object') continue;
    const id = typeof group.id === 'string' ? group.id : '';
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    const label = typeof group.label === 'string' && group.label !== '' ? group.label : id;
    out.push({ id, label, values: Array.isArray(group.values) ? group.values : [] });
  }
  return out;
}

function valueDomain(
  extents: readonly (readonly [number, number])[],
  domain: StatLayoutOptions['domain']
): [number, number] {
  if (
    domain &&
    Number.isFinite(domain[0]) &&
    Number.isFinite(domain[1]) &&
    domain[0] !== domain[1]
  ) {
    return [Math.min(domain[0], domain[1]), Math.max(domain[0], domain[1])];
  }
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const [a, b] of extents) {
    if (a < lo) lo = a;
    if (b > hi) hi = b;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) return [lo - (Math.abs(lo) || 1), hi + (Math.abs(hi) || 1)];
  const nice = niceDomain(lo, hi, 5);
  return Number.isFinite(nice[0]) && Number.isFinite(nice[1]) ? nice : [lo, hi];
}

function sampleEvenly<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  const out: T[] = [];
  const stride = (items.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i++) out.push(items[Math.round(i * stride)] as T);
  return out;
}

function axisTicks(
  domain: readonly [number, number],
  scale: (value: number) => number
): StatTick[] {
  return ticks(domain[0], domain[1], 5)
    .filter(Number.isFinite)
    .map((value) => ({ value, position: roundCoord(scale(value)) }));
}

export interface BoxMark {
  id: string;
  label: string;
  summary: BoxSummary;
  /** Center and width of the box along the category axis. */
  center: number;
  width: number;
  q1: number;
  median: number;
  q3: number;
  lowerWhisker: number;
  upperWhisker: number;
  /** Up to MAX_DRAWN_OUTLIERS, evenly sampled across the sorted outliers. */
  outliers: { value: number; position: number }[];
}

export interface BoxLayoutOptions extends StatLayoutOptions {
  whisker?: number;
}

export interface BoxLayout {
  marks: BoxMark[];
  /** Groups with no finite values, kept for the data table. */
  empty: { id: string; label: string }[];
  ticks: StatTick[];
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
}

/** Vertical Tukey box plots, one per group, on a shared value axis. */
export function createBoxLayout(
  groups: readonly StatGroup[] | null | undefined,
  options: BoxLayoutOptions = {}
): BoxLayout {
  const { width, height } = size(options);
  const plot = {
    left: MARGIN.left,
    right: width - MARGIN.right,
    top: MARGIN.top,
    bottom: height - MARGIN.bottom,
  };
  const normalized = normalizeGroups(groups);
  const summaries = normalized.map((group) => ({
    group,
    summary: boxSummarySorted(
      finiteSample(group.values).sorted,
      options.whisker === undefined ? {} : { whisker: options.whisker }
    ),
  }));
  const present = summaries.filter(
    (item): item is { group: StatGroup; summary: BoxSummary } => item.summary !== null
  );
  const domain = valueDomain(
    present.map(({ summary }) => [summary.min, summary.max] as const),
    options.domain
  );
  const y = linearScale({ domain, range: [plot.bottom, plot.top], clamp: true });
  const x = bandScale({
    domain: present.map(({ group }) => group.id),
    range: [plot.left, plot.right],
    paddingInner: 0.4,
    paddingOuter: 0.3,
  });
  const boxWidth = Math.min(96, x.bandwidth());
  return {
    marks: present.map(({ group, summary }) => {
      const start = x(group.id) ?? plot.left;
      return {
        id: group.id,
        label: group.label,
        summary,
        center: roundCoord(start + x.bandwidth() / 2),
        width: roundCoord(boxWidth),
        q1: roundCoord(y(summary.q1)),
        median: roundCoord(y(summary.median)),
        q3: roundCoord(y(summary.q3)),
        lowerWhisker: roundCoord(y(summary.lowerWhisker)),
        upperWhisker: roundCoord(y(summary.upperWhisker)),
        outliers: sampleEvenly(summary.outliers, MAX_DRAWN_OUTLIERS).map((value) => ({
          value,
          position: roundCoord(y(value)),
        })),
      };
    }),
    empty: summaries
      .filter((item) => item.summary === null)
      .map(({ group }) => ({ id: group.id, label: group.label })),
    ticks: axisTicks(domain, y),
    width,
    height,
    plot,
  };
}

export interface ViolinMark {
  id: string;
  label: string;
  summary: BoxSummary;
  density: DensityPoint[];
  center: number;
  /** Closed, mirrored density outline. */
  path: string;
  median: number;
  /** Half the violin's widest extent, for the median rule. */
  halfWidth: number;
}

export interface ViolinLayoutOptions extends StatLayoutOptions {
  bandwidth?: number;
  /** Density sample points per violin (default 48). */
  points?: number;
}

export interface ViolinLayout {
  marks: ViolinMark[];
  empty: { id: string; label: string }[];
  ticks: StatTick[];
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
}

/**
 * Mirrored kernel-density violins, one per group, on a shared value axis.
 * Widths share one density scale, so a wider violin means denser data.
 */
export function createViolinLayout(
  groups: readonly StatGroup[] | null | undefined,
  options: ViolinLayoutOptions = {}
): ViolinLayout {
  const { width, height } = size(options);
  const plot = {
    left: MARGIN.left,
    right: width - MARGIN.right,
    top: MARGIN.top,
    bottom: height - MARGIN.bottom,
  };
  const normalized = normalizeGroups(groups);
  // Sort each group once; the summary and the density share the sample.
  const summaries = normalized.map((group) => {
    const { sorted } = finiteSample(group.values);
    return { group, sorted, summary: boxSummarySorted(sorted) };
  });
  const present = summaries.filter(
    (item): item is { group: StatGroup; sorted: number[]; summary: BoxSummary } =>
      item.summary !== null
  );
  const domain = valueDomain(
    present.map(({ summary }) => [summary.min, summary.max] as const),
    options.domain
  );
  const densities = present.map(({ sorted }) =>
    kernelDensitySorted(sorted, {
      domain,
      points: options.points ?? 48,
      ...(options.bandwidth === undefined ? {} : { bandwidth: options.bandwidth }),
    })
  );
  let maxDensity = 0;
  for (const curve of densities) {
    for (const point of curve) if (point.density > maxDensity) maxDensity = point.density;
  }
  const y = linearScale({ domain, range: [plot.bottom, plot.top], clamp: true });
  const x = bandScale({
    domain: present.map(({ group }) => group.id),
    range: [plot.left, plot.right],
    paddingInner: 0.2,
    paddingOuter: 0.1,
  });
  const maxHalf = Math.min(64, x.bandwidth() / 2);
  return {
    marks: present.map(({ group, summary }, index) => {
      const density = densities[index] ?? [];
      const center = (x(group.id) ?? plot.left) + x.bandwidth() / 2;
      const half = (value: number) => (maxDensity > 0 ? (value / maxDensity) * maxHalf : 0);
      const right = density.map(
        (p) => `${roundCoord(center + half(p.density))},${roundCoord(y(p.x))}`
      );
      const left = density
        .map((p) => `${roundCoord(center - half(p.density))},${roundCoord(y(p.x))}`)
        .reverse();
      const outline = [...right, ...left];
      let widest = 0;
      for (const p of density) widest = Math.max(widest, half(p.density));
      return {
        id: group.id,
        label: group.label,
        summary,
        density,
        center: roundCoord(center),
        path: outline.length === 0 ? '' : `M${outline.join('L')}Z`,
        median: roundCoord(y(summary.median)),
        halfWidth: roundCoord(Math.max(4, widest * 0.6)),
      };
    }),
    empty: summaries
      .filter((item) => item.summary === null)
      .map(({ group }) => ({ id: group.id, label: group.label })),
    ticks: axisTicks(domain, y),
    width,
    height,
    plot,
  };
}

export interface EcdfMark {
  id: string;
  label: string;
  steps: EcdfStep[];
  count: number;
  /** Step path from p = 0 to p = 1. */
  path: string;
}

export interface EcdfLayout {
  marks: EcdfMark[];
  empty: { id: string; label: string }[];
  /** Ticks along the value (horizontal) axis. */
  ticks: StatTick[];
  /** Ticks along the cumulative-share (vertical) axis, 0…1. */
  shareTicks: StatTick[];
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
}

/** Empirical CDF step lines, one per series, on shared axes. */
export function createEcdfLayout(
  series: readonly StatGroup[] | null | undefined,
  options: StatLayoutOptions = {}
): EcdfLayout {
  const { width, height } = size(options);
  const plot = {
    left: MARGIN.left,
    right: width - MARGIN.right,
    top: MARGIN.top,
    bottom: height - MARGIN.bottom,
  };
  const normalized = normalizeGroups(series);
  const stepped = normalized.map((group) => ({
    group,
    steps: ecdfSorted(finiteSample(group.values).sorted),
  }));
  const present = stepped.filter((item) => item.steps.length > 0);
  const domain = valueDomain(
    present.map(({ steps }) => [steps[0]?.x ?? 0, steps.at(-1)?.x ?? 0] as const),
    options.domain
  );
  const x = linearScale({ domain, range: [plot.left, plot.right], clamp: true });
  const y = linearScale({ domain: [0, 1], range: [plot.bottom, plot.top] });
  return {
    marks: present.map(({ group, steps }) => {
      const parts = [`M${roundCoord(plot.left)},${roundCoord(plot.bottom)}`];
      for (const step of steps) {
        parts.push(`H${roundCoord(x(step.x))}`, `V${roundCoord(y(step.p))}`);
      }
      parts.push(`H${roundCoord(plot.right)}`);
      return {
        id: group.id,
        label: group.label,
        steps,
        count: steps.at(-1)?.count ?? 0,
        path: parts.join(''),
      };
    }),
    empty: stepped
      .filter((item) => item.steps.length === 0)
      .map(({ group }) => ({ id: group.id, label: group.label })),
    ticks: axisTicks(domain, x),
    shareTicks: [0, 0.25, 0.5, 0.75, 1].map((value) => ({ value, position: roundCoord(y(value)) })),
    width,
    height,
    plot,
  };
}

export function formatStatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function formatStatShare(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(
    value
  );
}

/** One row per ECDF series at its quartiles, for the data table (the full step list can be huge). */
export function ecdfQuantileRows(mark: EcdfMark): { share: number; value: number }[] {
  return [0.25, 0.5, 0.75, 1].map((share) => {
    const step = mark.steps.find((item) => item.p >= share) ?? mark.steps.at(-1);
    return { share, value: step?.x ?? Number.NaN };
  });
}
