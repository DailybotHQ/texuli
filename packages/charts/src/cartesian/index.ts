/** Lazy SVG chart family; import from `@texuli/charts/cartesian`. */

export type { ChartAnnotation, ChartAxisValue } from '../annotations/model.ts';
export type { CanvasRendererMode } from '../canvas/model.ts';
export { default as AreaChart } from './AreaChart.svelte';
export { default as BarChart } from './BarChart.svelte';
export { default as CartesianChart } from './CartesianChart.svelte';
export { default as ComboChart } from './ComboChart.svelte';
export { default as LineChart } from './LineChart.svelte';
export {
  assertCartesianSeries,
  assertCartesianXKind,
  CARTESIAN_X_KINDS,
  type CartesianDomain,
  type CartesianKind,
  type CartesianLayout,
  type CartesianPoint,
  type CartesianSeries,
  type CartesianXFormatter,
  type CartesianXKind,
  cartesianXFormatter,
  createCartesianLayout,
  lineCoordinates,
  type PlotPoint,
  resolveChartLocale,
  toInteractionSeries,
  windowCartesianSeries,
  xDomain,
} from './model.ts';
export { default as StackedBarChart } from './StackedBarChart.svelte';
export type { CartesianChartProps } from './shared-props.ts';
