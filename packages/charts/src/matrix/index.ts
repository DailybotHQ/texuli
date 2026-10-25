/** Lazy SVG matrix chart family; import from `@texuli/charts/matrix`. */
export type { ChartAnnotation, ChartAxisValue } from '../annotations/model.ts';
export { default as BubbleChart } from './BubbleChart.svelte';
export { default as HeatmapChart } from './HeatmapChart.svelte';
export { default as MatrixFrame } from './MatrixFrame.svelte';
export {
  assertHeatmapCells,
  assertScatterPoints,
  createHeatmapLayout,
  createScatterLayout,
  formatMatrixNumber,
  type HeatmapCell,
  type HeatmapLayout,
  heatmapFill,
  heatmapInteractionSeries,
  type MatrixKind,
  matrixSeriesColor,
  type ScatterLayout,
  type ScatterPoint,
  type ScatterSeries,
  scatterInteractionSeries,
} from './model.ts';
export { default as ScatterChart } from './ScatterChart.svelte';
