/**
 * Chart interaction family (T-charts-interaction): keyboard/pointer exploration,
 * tooltips, legends, series toggles, crosshair, zoom and brush helpers.
 */

export { default as ChartTable } from './ChartTable.svelte';
export { default as InteractivePlot } from './InteractivePlot.svelte';
export { default as Legend } from './Legend.svelte';
export {
  type ActivePoint,
  type Box,
  type BrushRange,
  brushToDomain,
  type ChartCrosshair,
  type ChartFormatters,
  type ChartSelection,
  clampZoomDomain,
  type DomainPair,
  edgeIndex,
  firstActive,
  type LegendItem,
  type LegendSymbol,
  nearestIndex,
  nearestPoint2d,
  normalizeBrush,
  type PlotPoint,
  type PlotSeries,
  prefersReducedMotion,
  seriesColor,
  stepIndex,
  stepSeries,
  type TableWindow,
  type TooltipRow,
  tableRows,
  tableWindow,
  toggleSeries,
  tooltipPosition,
  zoomDomain,
} from './model.ts';
export { default as TableToggle } from './TableToggle.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as TooltipCrosshairLayer } from './TooltipCrosshairLayer.svelte';
