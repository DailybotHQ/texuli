// `@texuli/media/composition-canvas`: the component and the pure helpers. The
// validator and the draw engine load lazily (`./render` and `./draw`
// subpaths), so this entry stays small.
export { default as CompositionCanvas } from './CompositionCanvas.svelte';
export { type CompositionTextItem, describeComposition } from './describe.ts';
export type {
  CompositionContext2D,
  CompositionImage,
  CompositionViewport,
  DrawCompositionOptions,
  DrawReport,
  DrawSkipReason,
  ScratchSurface,
} from './draw.ts';
export {
  applyMatrix,
  CANVAS_LIMITS,
  canvasBackingSize,
  fitImage,
  IDENTITY,
  intersects,
  layerBounds,
  layerMatrix,
  linearGradientLine,
  type Matrix,
  multiply,
  type Rect,
  radialGradientCircle,
  wrapText,
} from './geometry.ts';
export type {
  CompositionImageLoader,
  LoadCompositionImagesOptions,
  LoadedCompositionImages,
} from './images.ts';
export {
  type CompositionCanvasLabels,
  DEFAULT_COMPOSITION_CANVAS_LABELS,
  resolveCompositionCanvasLabels,
} from './labels.ts';
export type {
  CompositionCanvasTarget,
  RenderCompositionOptions,
  RenderCompositionResult,
} from './render.ts';
export {
  applyViewportAction,
  clampViewport,
  initialViewport,
  panViewport,
  VIEWPORT_LIMITS,
  type ViewportAction,
  viewportKeyAction,
  zoomViewport,
} from './viewport.ts';
