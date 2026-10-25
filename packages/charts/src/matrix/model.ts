import { categoricalColor, sequentialColor } from '../colors/index.ts';
import type { PlotSeries } from '../interaction/model.ts';
import { bandScale, extent, linearScale, ticks } from '../math/index.ts';

/** One heatmap cell. Categories are strings; value drives sequential color. */
export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
}

/** Scatter / bubble point. */
export interface ScatterPoint {
  id: string;
  /** Accessible short label for the point (table + title). */
  label: string;
  x: number;
  y: number;
  /** Bubble radius domain value (bubble charts only). */
  r?: number;
  /** Optional series key for multi-series scatter. */
  seriesId?: string;
  color?: string;
}

export interface ScatterSeries {
  id: string;
  label: string;
  color?: string;
}

export type MatrixKind = 'heatmap' | 'scatter' | 'bubble';

export interface HeatmapLayout {
  xKeys: string[];
  yKeys: string[];
  cells: readonly {
    id: string;
    x: string;
    y: string;
    value: number;
    xPos: number;
    yPos: number;
    width: number;
    height: number;
    /** 0..1 normalized for color ramp. */
    t: number;
  }[];
  valueDomain: readonly [number, number];
  xBand: ReturnType<typeof bandScale>;
  yBand: ReturnType<typeof bandScale>;
}

export interface ScatterLayout {
  points: readonly {
    id: string;
    label: string;
    x: number;
    y: number;
    r: number;
    cx: number;
    cy: number;
    radius: number;
    color: string;
    seriesId?: string;
  }[];
  xScale: ReturnType<typeof linearScale>;
  yScale: ReturnType<typeof linearScale>;
  xTicks: number[];
  yTicks: number[];
  series: readonly ScatterSeries[];
}

/** Convert heatmap cells to row series for the shared keyboard/pointer explorer. */
export function heatmapInteractionSeries(layout: HeatmapLayout): PlotSeries<HeatmapCell>[] {
  const byRow = new Map<string, PlotSeries<HeatmapCell>['points'][number][]>();
  for (const cell of layout.cells) {
    const points = byRow.get(cell.y) ?? [];
    points.push({
      x: cell.xPos + cell.width / 2,
      y: cell.yPos + cell.height / 2,
      xValue: cell.x,
      yValue: cell.value,
      color: heatmapFill(cell.t),
      datum: { x: cell.x, y: cell.y, value: cell.value },
    });
    byRow.set(cell.y, points);
  }
  return layout.yKeys.map((row) => ({
    id: row,
    label: row,
    points: (byRow.get(row) ?? []).sort((a, b) => a.x - b.x),
  }));
}

/** Convert scatter/bubble layout points to series for the shared explorer. */
export function scatterInteractionSeries(layout: ScatterLayout): PlotSeries<ScatterPoint>[] {
  return layout.series.map((series) => ({
    id: series.id,
    label: series.label,
    color: series.color,
    points: layout.points
      .filter((point) => (point.seriesId ?? 'default') === series.id)
      .map((point) => ({
        x: point.cx,
        y: point.cy,
        xValue: point.x,
        yValue: point.y,
        label: point.label,
        color: point.color,
        datum: {
          id: point.id,
          label: point.label,
          x: point.x,
          y: point.y,
          r: point.r,
          ...(point.seriesId === undefined ? {} : { seriesId: point.seriesId }),
          color: point.color,
        },
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y),
  }));
}

export function matrixSeriesColor(index: number, explicit?: string): string {
  if (explicit) return explicit;
  return categoricalColor(index);
}

/** Sequential fill for heatmap cells using chart sequential tokens when present. */
export function heatmapFill(t: number): string {
  return sequentialColor(t);
}

export function formatMatrixNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function assertHeatmapCells(cells: readonly HeatmapCell[]): void {
  if (!Array.isArray(cells)) throw new TypeError('Heatmap needs a cells array.');
  for (const [index, cell] of cells.entries()) {
    if (!cell || typeof cell.x !== 'string' || cell.x.trim() === '') {
      throw new TypeError(`Heatmap cell ${index} needs a non-empty x category.`);
    }
    if (typeof cell.y !== 'string' || cell.y.trim() === '') {
      throw new TypeError(`Heatmap cell ${index} needs a non-empty y category.`);
    }
    if (!Number.isFinite(cell.value)) {
      throw new TypeError(`Heatmap cell ${index} needs a finite value.`);
    }
  }
}

export function assertScatterPoints(
  points: readonly ScatterPoint[],
  options: { requireRadius?: boolean } = {}
): void {
  if (!Array.isArray(points)) throw new TypeError('Scatter/bubble charts need a points array.');
  const ids = new Set<string>();
  for (const [index, point] of points.entries()) {
    if (!point || typeof point.id !== 'string' || point.id.trim() === '') {
      throw new TypeError(`Point ${index} needs a non-empty id.`);
    }
    if (ids.has(point.id)) throw new TypeError(`Duplicate point id "${point.id}".`);
    ids.add(point.id);
    if (typeof point.label !== 'string' || point.label.trim() === '') {
      throw new TypeError(`Point "${point.id}" needs a non-empty label.`);
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new TypeError(`Point "${point.id}" needs finite x and y.`);
    }
    if (options.requireRadius) {
      if (point.r === undefined || !Number.isFinite(point.r) || point.r < 0) {
        throw new TypeError(`Bubble point "${point.id}" needs a non-negative finite r.`);
      }
    } else if (point.r !== undefined && (!Number.isFinite(point.r) || point.r < 0)) {
      throw new TypeError(`Point "${point.id}" r must be a non-negative finite number when set.`);
    }
  }
}

export function createHeatmapLayout(
  cells: readonly HeatmapCell[],
  width = 640,
  height = 360,
  margin = { top: 16, right: 16, bottom: 48, left: 72 }
): HeatmapLayout {
  assertHeatmapCells(cells);
  const xKeys = [...new Set(cells.map((cell) => cell.x))];
  const yKeys = [...new Set(cells.map((cell) => cell.y))];
  const xBand = bandScale({
    domain: xKeys,
    range: [margin.left, width - margin.right],
    paddingInner: 0.08,
    paddingOuter: 0.04,
  });
  const yBand = bandScale({
    domain: yKeys,
    range: [margin.top, height - margin.bottom],
    paddingInner: 0.08,
    paddingOuter: 0.04,
  });
  const values = cells.map((cell) => cell.value);
  const domain = extent(values) ?? [0, 1];
  const span = domain[1] - domain[0] || 1;
  const laid = cells.map((cell) => {
    const xPos = xBand(cell.x) ?? margin.left;
    const yPos = yBand(cell.y) ?? margin.top;
    const t = (cell.value - domain[0]) / span;
    return {
      id: `${cell.x}::${cell.y}`,
      x: cell.x,
      y: cell.y,
      value: cell.value,
      xPos,
      yPos,
      width: xBand.bandwidth(),
      height: yBand.bandwidth(),
      t,
    };
  });
  return {
    xKeys,
    yKeys,
    cells: laid,
    valueDomain: domain,
    xBand,
    yBand,
  };
}

export function createScatterLayout(
  points: readonly ScatterPoint[],
  options: {
    width?: number;
    height?: number;
    margin?: { top: number; right: number; bottom: number; left: number };
    series?: readonly ScatterSeries[];
    bubble?: boolean;
  } = {}
): ScatterLayout {
  const bubble = options.bubble === true;
  assertScatterPoints(points, { requireRadius: bubble });
  const width = options.width ?? 640;
  const height = options.height ?? 360;
  const margin = options.margin ?? { top: 16, right: 16, bottom: 48, left: 56 };
  const xExtent = extent(points.map((p) => p.x)) ?? [0, 1];
  const yExtent = extent(points.map((p) => p.y)) ?? [0, 1];
  const xScale = linearScale({
    domain: xExtent[0] === xExtent[1] ? [xExtent[0] - 1, xExtent[1] + 1] : xExtent,
    range: [margin.left, width - margin.right],
    nice: true,
  });
  const yScale = linearScale({
    domain: yExtent[0] === yExtent[1] ? [yExtent[0] - 1, yExtent[1] + 1] : yExtent,
    range: [height - margin.bottom, margin.top],
    nice: true,
  });
  const rValues = points.map((p) => p.r ?? 1);
  const rExtent = extent(rValues) ?? [1, 1];
  const rScale = linearScale({
    domain: rExtent[0] === rExtent[1] ? [0, rExtent[1] || 1] : rExtent,
    range: bubble ? [6, 28] : [4, 4],
    nice: false,
    clamp: true,
  });

  const seriesMap = new Map((options.series ?? []).map((s) => [s.id, s]));
  const seriesOrder: ScatterSeries[] = [];
  const seen = new Set<string>();
  for (const point of points) {
    const sid = point.seriesId ?? 'default';
    if (seen.has(sid)) continue;
    seen.add(sid);
    seriesOrder.push(
      seriesMap.get(sid) ?? {
        id: sid,
        label: sid === 'default' ? 'Points' : sid,
      }
    );
  }

  const seriesIndex = new Map(seriesOrder.map((s, i) => [s.id, i]));

  return {
    points: points.map((point) => {
      const sid = point.seriesId ?? 'default';
      const index = seriesIndex.get(sid) ?? 0;
      const meta = seriesMap.get(sid);
      return {
        id: point.id,
        label: point.label,
        x: point.x,
        y: point.y,
        r: point.r ?? 1,
        cx: xScale(point.x),
        cy: yScale(point.y),
        radius: rScale(point.r ?? 1),
        color: matrixSeriesColor(index, point.color ?? meta?.color),
        seriesId: point.seriesId,
      };
    }),
    xScale,
    yScale,
    xTicks: ticks(xScale.domain[0], xScale.domain[1], 5),
    yTicks: ticks(yScale.domain[0], yScale.domain[1], 5),
    series: seriesOrder,
  };
}
