import type { SparklineGeometry } from '../compact/shared.ts';

/**
 * Bar sparkline geometry as two SVG path strings: every bar before the latest
 * drawable value, and the latest one. One path per group keeps the DOM at two
 * elements whatever the series length.
 */
export function barsPaths(data: SparklineGeometry): { rest: string; last: string } {
  let rest = '';
  let last = '';
  data.points.forEach((point, index) => {
    if (point.y === null) return;
    const top = Math.min(point.y, data.baseline);
    const size = Math.max(0.5, Math.abs(data.baseline - point.y));
    const bar = `M${point.x - data.barWidth / 2},${top}h${data.barWidth}v${size}h${-data.barWidth}Z`;
    if (index === data.last) last = bar;
    else rest += bar;
  });
  return { rest, last };
}
