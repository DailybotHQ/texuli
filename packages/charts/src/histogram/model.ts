import type { AxisTick } from '../axis/model.ts';
import { type BinOptions, bin, linearScale, ticks } from '../math/index.ts';

export interface HistogramTableLabels {
  table: string;
  range: string;
  count: string;
}

export interface HistogramLayoutOptions extends BinOptions {
  width?: number;
  height?: number;
}

export interface HistogramBar {
  x0: number;
  x1: number;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HistogramLayout {
  bars: HistogramBar[];
  xTicks: AxisTick<number>[];
  yTicks: AxisTick<number>[];
  width: number;
  height: number;
  baseline: number;
  maxCount: number;
}

export const HISTOGRAM_TABLE_LABELS: HistogramTableLabels = {
  table: 'View data table',
  range: 'Range',
  count: 'Count',
};

export function histogramLabels(
  labels: Partial<HistogramTableLabels> | undefined
): HistogramTableLabels {
  return { ...HISTOGRAM_TABLE_LABELS, ...labels };
}

/** Build SVG-ready histogram bars from the public `bin` chart math. */
export function createHistogramLayout(
  values: readonly (number | null)[],
  options: HistogramLayoutOptions = {}
): HistogramLayout {
  const width = Number.isFinite(options.width) ? Math.max(120, options.width as number) : 640;
  const height = Number.isFinite(options.height) ? Math.max(100, options.height as number) : 320;
  const margin = { top: 16, right: 16, bottom: 28, left: 36 };
  const bins = bin(values, {
    ...(options.thresholds === undefined ? {} : { thresholds: options.thresholds }),
    ...(options.count === undefined ? {} : { count: options.count }),
    ...(options.domain === undefined ? {} : { domain: options.domain }),
  });
  const baseline = height - margin.bottom;
  let maxCount = 0;
  for (const item of bins) if (item.count > maxCount) maxCount = item.count;
  const first = bins[0];
  const last = bins.at(-1);
  const xDomain: readonly [number, number] = [first?.x0 ?? 0, last?.x1 ?? 1];
  const sameEdge = xDomain[0] === xDomain[1];
  // Halved terms keep positions finite when the edges span more than Number.MAX_VALUE.
  const xSpan = xDomain[1] / 2 - xDomain[0] / 2;
  const x = (value: number) =>
    xSpan === 0
      ? (margin.left + width - margin.right) / 2
      : margin.left + ((value / 2 - xDomain[0] / 2) / xSpan) * (width - margin.right - margin.left);
  const y = linearScale({
    domain: [0, Math.max(1, maxCount)],
    range: [baseline, margin.top],
  });
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const xTicks = ticks(xDomain[0], xDomain[1], 5).map((value) => ({
    value,
    position: x(value) - margin.left,
  }));
  const yTicks = ticks(0, Math.max(1, maxCount), 4).map((value) => ({
    value,
    position: y(value) - margin.top,
  }));

  return {
    bars: bins.map((item) => {
      const x0 = sameEdge ? margin.left : x(item.x0);
      const x1 = sameEdge ? width - margin.right : x(item.x1);
      const top = y(item.count);
      return {
        ...item,
        x: x0,
        y: top,
        width: sameEdge ? plotWidth : Math.max(1, x1 - x0 - 1),
        height: Math.max(0, baseline - top),
      };
    }),
    xTicks,
    yTicks,
    width,
    height,
    baseline,
    maxCount,
  };
}

export function formatHistogramNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function formatHistogramRange(x0: number, x1: number): string {
  if (x0 === x1) return formatHistogramNumber(x0);
  return `${formatHistogramNumber(x0)}–${formatHistogramNumber(x1)}`;
}
