/** Canvas marks and downsampling for dense series; import from `@texuli/charts/canvas`. */
export { default as CanvasRenderer } from './CanvasRenderer.svelte';
export {
  CANVAS_POINT_THRESHOLD,
  type CanvasBar,
  type CanvasChartKind,
  type CanvasPoint,
  type CanvasRendererMode,
  type CanvasSeries,
  downsampleCanvasPoints,
  drawCanvasChart,
  useCanvas,
} from './model.ts';
