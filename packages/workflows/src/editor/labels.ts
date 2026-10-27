/**
 * Every string the workflow editor, viewer and inspector show or announce.
 * Drag lifecycle text goes through `@texuli/drag/messages` (`DragMessages`);
 * the rest are {@link WorkflowLabels}. English defaults ship; a locale
 * overrides any field. All output is plain text.
 */
import {
  type DragMessages,
  type DragMessagesOverrides,
  formatDragMessage,
  resolveDragMessages,
} from '@texuli/drag/messages';
import type { WorkflowErrorCode } from '../model/types.ts';

/** Values a label template may use as `{name}`. */
export interface LabelValues {
  node?: string;
  port?: string;
  type?: string;
  target?: string;
  count?: number;
  index?: number;
  total?: number;
  percent?: number;
  reason?: string;
}

/** A template (`'Connected {port} to {target}.'`) or a function. */
export type WorkflowLabel = string | ((values: LabelValues) => string);

export interface WorkflowLabels {
  canvas: WorkflowLabel;
  canvasInstructions: WorkflowLabel;
  toolbar: WorkflowLabel;
  zoomIn: WorkflowLabel;
  zoomOut: WorkflowLabel;
  fit: WorkflowLabel;
  undo: WorkflowLabel;
  redo: WorkflowLabel;
  autoLayout: WorkflowLabel;
  remove: WorkflowLabel;
  group: WorkflowLabel;
  ungroup: WorkflowLabel;
  newGroup: WorkflowLabel;
  palette: WorkflowLabel;
  addNode: WorkflowLabel;
  minimap: WorkflowLabel;
  inputPort: WorkflowLabel;
  outputPort: WorkflowLabel;
  nodeSelected: WorkflowLabel;
  nodeSummary: WorkflowLabel;
  connectStart: WorkflowLabel;
  connectCandidate: WorkflowLabel;
  connectNone: WorkflowLabel;
  connected: WorkflowLabel;
  connectCancelled: WorkflowLabel;
  disconnected: WorkflowLabel;
  added: WorkflowLabel;
  removed: WorkflowLabel;
  nudged: WorkflowLabel;
  selection: WorkflowLabel;
  copied: WorkflowLabel;
  pasted: WorkflowLabel;
  undone: WorkflowLabel;
  redone: WorkflowLabel;
  zoomed: WorkflowLabel;
  laidOut: WorkflowLabel;
  refused: WorkflowLabel;
  outline: WorkflowLabel;
  outlineName: WorkflowLabel;
  outlineType: WorkflowLabel;
  outlineConnect: WorkflowLabel;
  outlineDelete: WorkflowLabel;
  outlineEdge: WorkflowLabel;
  outlineConnectTo: WorkflowLabel;
  outlineRename: WorkflowLabel;
  disconnect: WorkflowLabel;
  inspector: WorkflowLabel;
  inspectorEmpty: WorkflowLabel;
  inspectorLabel: WorkflowLabel;
  inspectorPositionX: WorkflowLabel;
  inspectorPositionY: WorkflowLabel;
  inspectorPorts: WorkflowLabel;
  inspectorConnections: WorkflowLabel;
  invalidUrl: WorkflowLabel;
  viewer: WorkflowLabel;
  viewerConnection: WorkflowLabel;
  /** Human text for each refusal code. */
  reasons: Readonly<Record<WorkflowErrorCode, WorkflowLabel>>;
}

export const DEFAULT_WORKFLOW_LABELS: WorkflowLabels = Object.freeze({
  canvas: 'Workflow canvas',
  canvasInstructions:
    'Arrow keys move between nodes. Alt with an arrow key moves the node. Space selects. Tab reaches the ports; Enter on a port starts a connection. Delete removes. Control Z undoes, Control Y redoes. Control plus and minus zoom; 0 fits the view.',
  toolbar: 'Workflow tools',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit to view',
  undo: 'Undo',
  redo: 'Redo',
  autoLayout: 'Auto layout',
  remove: 'Delete selection',
  group: 'Group selection',
  ungroup: 'Ungroup',
  newGroup: 'Group {index}',
  palette: 'Node types',
  addNode: 'Add {type}',
  minimap: 'Minimap',
  inputPort: '{port} input of {node}',
  outputPort: '{port} output of {node}',
  nodeSelected: 'selected',
  nodeSummary: '{type}. {count} connections.',
  connectStart:
    'Connecting from {port} of {node}. {total} compatible ports. Arrow keys choose, Enter connects, Escape cancels.',
  connectCandidate: '{port} of {node}, {index} of {total}.',
  connectNone: 'No compatible port for {port} of {node}.',
  connected: 'Connected {port} to {target}.',
  connectCancelled: 'Connection cancelled.',
  disconnected: 'Connection removed.',
  added: '{node} added.',
  removed: '{count} removed.',
  nudged: '{node} moved.',
  selection: '{count} selected.',
  copied: '{count} copied.',
  pasted: '{count} pasted.',
  undone: 'Undone.',
  redone: 'Redone.',
  zoomed: 'Zoom {percent}%.',
  laidOut: 'Layout applied.',
  refused: 'Not changed: {reason}.',
  outline: 'Workflow outline',
  outlineName: 'Name',
  outlineType: 'Type',
  outlineConnect: 'Connect {node}',
  outlineDelete: 'Delete {node}',
  outlineEdge: '{port} to {target}',
  outlineConnectTo: 'Connect {node} to',
  outlineRename: 'Rename {node}',
  disconnect: 'Remove connection {port} to {target}',
  inspector: 'Inspector',
  inspectorEmpty: 'Select one node to edit it.',
  inspectorLabel: 'Label',
  inspectorPositionX: 'X',
  inspectorPositionY: 'Y',
  inspectorPorts: 'Ports',
  inspectorConnections: '{port}: {count} connections',
  invalidUrl: 'Use an https link or a relative path.',
  viewer: 'Workflow',
  viewerConnection: '{node} {port} to {target}',
  reasons: Object.freeze({
    'invalid-op': 'the edit is not allowed',
    'invalid-value': 'a value is not valid',
    'unknown-type': 'the node type is not available',
    'unknown-id': 'it no longer exists',
    'unknown-port': 'the port does not exist',
    'duplicate-id': 'that id is already used',
    'port-direction': 'connections run from an output to an input',
    'port-type': 'the port types do not match',
    cardinality: 'the port takes only one connection',
    'duplicate-edge': 'those ports are already connected',
    cycle: 'it would create a loop',
    limit: 'the workflow is full',
    'unsafe-url': 'the link is not allowed',
    'unsafe-text': 'the text holds hidden control characters',
    'already-grouped': 'a node is already in a group',
    'validation-failed': 'the workflow would not be valid',
  }),
});

export type WorkflowLabelsOverrides = Partial<Omit<WorkflowLabels, 'reasons'>> & {
  reasons?: Partial<WorkflowLabels['reasons']>;
};

export function resolveWorkflowLabels(overrides: WorkflowLabelsOverrides = {}): WorkflowLabels {
  return Object.freeze({
    ...DEFAULT_WORKFLOW_LABELS,
    ...overrides,
    reasons: Object.freeze({ ...DEFAULT_WORKFLOW_LABELS.reasons, ...overrides.reasons }),
  });
}

const PLACEHOLDER = /\{(node|port|type|target|count|index|total|percent|reason)\}/g;

/** Fill a label template; missing values become empty text. */
export function formatLabel(label: WorkflowLabel, values: LabelValues = {}): string {
  if (typeof label === 'function') return label(values);
  return label.replace(PLACEHOLDER, (_, key: keyof LabelValues) => {
    const value = values[key];
    return value === undefined ? '' : String(value);
  });
}

/** Spatial wording for the drag lifecycle; any locale overrides it through `messages`. */
export const WORKFLOW_DRAG_MESSAGES: DragMessagesOverrides = Object.freeze({
  roleDescription: 'node',
  itemsLabel: '{count} nodes',
  pickedUp: '{item} picked up.',
  pickedUpMany: '{count} nodes picked up.',
  moved: '{item} moved.',
  dropped: '{item} moved.',
  cancelled: 'Move cancelled. {item} returned.',
});

export function resolveWorkflowDragMessages(overrides: DragMessagesOverrides = {}): DragMessages {
  return resolveDragMessages({
    ...WORKFLOW_DRAG_MESSAGES,
    ...overrides,
    reasons: { ...WORKFLOW_DRAG_MESSAGES.reasons, ...overrides.reasons },
  });
}

export { formatDragMessage };
