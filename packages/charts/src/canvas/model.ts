import { minMaxBuckets } from '../math/downsample/min-max.ts';

/** Above this many source points, automatic rendering uses Canvas instead of SVG marks. */
export const CANVAS_POINT_THRESHOLD = 5_000;

export type CanvasRendererMode = 'auto' | 'svg' | 'canvas';
export type CanvasChartKind = 'line' | 'area' | 'bar' | 'stacked-bar' | 'combo';

export interface CanvasBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasPoint {
  x: number;
  y: number | null;
  /** Area baseline or bar base in CSS pixels. */
  y0: number;
  bar?: CanvasBar;
}

export interface CanvasSeries {
  id: string;
  label: string;
  color: string;
  points: readonly CanvasPoint[];
}

/** Canvas is selected explicitly or when the source mark count reaches the threshold. */
export function useCanvas(mode: CanvasRendererMode, pointCount: number): boolean {
  if (mode === 'canvas') return true;
  return mode === 'auto' && pointCount >= CANVAS_POINT_THRESHOLD;
}

/** Retain first, last, minimum, maximum and gaps for each horizontal pixel bucket. */
export function downsampleCanvasPoints(
  points: readonly CanvasPoint[],
  width: number
): CanvasPoint[] {
  if (points.length === 0) return [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y ?? Number.NaN);
  const indices = minMaxBuckets(xs, ys, {
    buckets: Math.max(1, Math.ceil(width)),
    x0: xs[0] as number,
    x1: xs.at(-1) as number,
  });
  return indices.map((index) => points[index] as CanvasPoint);
}

/** Paint chart marks to an already scaled 2D context. No DOM access is needed. */
export function drawCanvasChart(
  context: CanvasRenderingContext2D,
  kind: CanvasChartKind,
  series: readonly CanvasSeries[],
  width: number,
  height: number
): void {
  context.clearRect(0, 0, width, height);
  for (const [seriesIndex, item] of series.entries()) {
    context.fillStyle = item.color;
    context.strokeStyle = item.color;
    context.lineWidth = 2.5;

    if (kind === 'bar' || kind === 'stacked-bar' || (kind === 'combo' && seriesIndex === 0)) {
      for (const point of item.points) {
        const bar = point.bar;
        if (bar) context.fillRect(bar.x, bar.y, bar.width, bar.height);
      }
    }

    if (kind === 'line' || kind === 'area' || (kind === 'combo' && seriesIndex > 0)) {
      if (kind === 'area') {
        const runs: CanvasPoint[][] = [];
        let run: CanvasPoint[] = [];
        for (const point of item.points) {
          if (point.y === null) {
            if (run.length > 0) runs.push(run);
            run = [];
          } else run.push(point);
        }
        if (run.length > 0) runs.push(run);
        for (const area of runs) {
          const first = area[0] as CanvasPoint;
          const last = area.at(-1) as CanvasPoint;
          context.beginPath();
          context.moveTo(first.x, first.y0);
          context.lineTo(first.x, first.y as number);
          for (let index = 1; index < area.length; index += 1) {
            const point = area[index] as CanvasPoint;
            context.lineTo(point.x, point.y as number);
          }
          context.lineTo(last.x, last.y0);
          for (let index = area.length - 2; index >= 0; index -= 1) {
            const point = area[index] as CanvasPoint;
            context.lineTo(point.x, point.y0);
          }
          context.closePath();
          context.globalAlpha = 0.2;
          context.fill();
          context.globalAlpha = 1;
        }
      }

      context.beginPath();
      let active = false;
      for (const point of item.points) {
        if (point.y === null) {
          active = false;
          continue;
        }
        if (active) context.lineTo(point.x, point.y);
        else context.moveTo(point.x, point.y);
        active = true;
      }
      context.stroke();
    }
  }
}
