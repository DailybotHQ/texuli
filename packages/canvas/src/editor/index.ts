/**
 * @texuli/canvas/editor: the accessible infinite canvas editor (Svelte 5).
 * `CanvasEditor` composes the toolbar, the application surface with its
 * minimap and the shape tree over one `CanvasController`; each part is
 * exported for custom layouts.
 */
export { default as CanvasEditor } from './CanvasEditor.svelte';
export { default as CanvasMinimap } from './CanvasMinimap.svelte';
export { default as CanvasShapeList } from './CanvasShapeList.svelte';
export { default as CanvasSurface } from './CanvasSurface.svelte';
export { default as CanvasToolbar } from './CanvasToolbar.svelte';
export {
  type CanvasBackend,
  CanvasController,
  type CanvasControllerOptions,
  DEFAULT_SIZES,
  historyBackend,
  syncBackend,
  ZOOM_LIMITS,
} from './controller.svelte.ts';
export {
  CANVAS_TOOLS,
  type CanvasCommand,
  type CanvasTool,
  canvasCommand,
  type Direction,
  directionDelta,
  type KeyLike,
  TOOL_KEYS,
} from './keyboard.ts';
export {
  type CanvasLabel,
  type CanvasLabelOverrides,
  type CanvasLabels,
  type CanvasLabelValues,
  DEFAULT_CANVAS_LABELS,
  formatCanvasLabel,
  resolveCanvasLabels,
} from './labels.ts';
export { default as ShapeView, type ShapeFocus } from './ShapeView.svelte';
