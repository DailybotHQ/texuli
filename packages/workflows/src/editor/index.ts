/**
 * @texuli/workflows/editor — the interactive workflow editor (Svelte 5).
 * `WorkflowEditor` is the whole editor; the canvas, palette, toolbar,
 * minimap and outline are exported too, each driven by one
 * `WorkflowController`, so hosts compose their own layout.
 */
export { connectCandidates, type PortEnd, type PortTarget } from './connect.ts';
export {
  CLIPBOARD_KEY,
  type ConnectState,
  type FocusTarget,
  type Wire,
  WorkflowController,
  type WorkflowControllerOptions,
  ZOOM_LIMITS,
} from './controller.svelte.ts';
export {
  type Box,
  buildScene,
  DEFAULT_WORKFLOW_NODE_SIZE,
  edgeCurve,
  type FlowDirection,
  type FocusDirection,
  type NodeSize,
  nearestInDirection,
  type PortPlacement,
  portPlacements,
  type Scene,
  sizeOf,
  type TextDirection,
} from './geometry.ts';
export {
  type CanvasCommand,
  type ConnectCommand,
  canvasCommand,
  connectCommand,
  physicalDirection,
} from './keyboard.ts';
export {
  DEFAULT_WORKFLOW_LABELS,
  formatLabel,
  type LabelValues,
  resolveWorkflowDragMessages,
  resolveWorkflowLabels,
  WORKFLOW_DRAG_MESSAGES,
  type WorkflowLabel,
  type WorkflowLabels,
  type WorkflowLabelsOverrides,
} from './labels.ts';
export { default as WorkflowNodeBody } from './NodeBody.svelte';
export type { WorkflowNodeContext } from './types.ts';
export { default as WorkflowCanvas } from './WorkflowCanvas.svelte';
export { default as WorkflowEditor } from './WorkflowEditor.svelte';
export { default as WorkflowMinimap } from './WorkflowMinimap.svelte';
export { default as WorkflowOutline } from './WorkflowOutline.svelte';
export { default as WorkflowPalette } from './WorkflowPalette.svelte';
export { default as WorkflowToolbar } from './WorkflowToolbar.svelte';
