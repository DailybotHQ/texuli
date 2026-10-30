/**
 * Every string the canvas editor and viewer show or announce. English
 * defaults ship; a locale overrides any field. Templates take `{name}`
 * values; all output is plain text (painted as text nodes).
 */

export interface CanvasLabelValues {
  name?: string;
  target?: string;
  count?: number;
  percent?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  degrees?: number;
  tool?: string;
}

/** A template (`'Moved {name}.'`) or a function. */
export type CanvasLabel = string | ((values: CanvasLabelValues) => string);

export interface CanvasLabels {
  canvas: CanvasLabel;
  instructions: CanvasLabel;
  roleDescription: CanvasLabel;
  shapeList: CanvasLabel;
  toolbar: CanvasLabel;
  minimap: CanvasLabel;
  tools: {
    select: CanvasLabel;
    hand: CanvasLabel;
    rect: CanvasLabel;
    ellipse: CanvasLabel;
    diamond: CanvasLabel;
    line: CanvasLabel;
    arrow: CanvasLabel;
    draw: CanvasLabel;
    text: CanvasLabel;
    sticky: CanvasLabel;
    frame: CanvasLabel;
    connector: CanvasLabel;
  };
  undo: CanvasLabel;
  redo: CanvasLabel;
  zoomIn: CanvasLabel;
  zoomOut: CanvasLabel;
  fit: CanvasLabel;
  remove: CanvasLabel;
  group: CanvasLabel;
  ungroup: CanvasLabel;
  editText: CanvasLabel;
  /** Shape kinds, for names of shapes without text. */
  kinds: Record<string, CanvasLabel>;
  connector: CanvasLabel;
  selected: CanvasLabel;
  selectionCleared: CanvasLabel;
  moved: CanvasLabel;
  resized: CanvasLabel;
  rotated: CanvasLabel;
  added: CanvasLabel;
  removed: CanvasLabel;
  grouped: CanvasLabel;
  ungrouped: CanvasLabel;
  connectStart: CanvasLabel;
  connectTarget: CanvasLabel;
  connected: CanvasLabel;
  connectCancelled: CanvasLabel;
  copied: CanvasLabel;
  pasted: CanvasLabel;
  pasteRefused: CanvasLabel;
  undone: CanvasLabel;
  redone: CanvasLabel;
  zoomed: CanvasLabel;
  toolChosen: CanvasLabel;
  reordered: CanvasLabel;
  refused: CanvasLabel;
  editing: CanvasLabel;
  empty: CanvasLabel;
  imageMissing: CanvasLabel;
}

export type CanvasLabelOverrides = Partial<Omit<CanvasLabels, 'tools' | 'kinds'>> & {
  tools?: Partial<CanvasLabels['tools']>;
  kinds?: Partial<CanvasLabels['kinds']>;
};

export const DEFAULT_CANVAS_LABELS: CanvasLabels = Object.freeze({
  canvas: 'Canvas',
  instructions:
    'Tab moves between shapes in reading order. Arrow keys move the selection, Shift with arrow keys resizes it, and the brackets rotate it. Enter edits text, Delete removes, K connects to another shape. Plus and minus zoom; arrow keys on the empty canvas pan.',
  roleDescription: 'infinite canvas',
  shapeList: 'Shapes',
  toolbar: 'Canvas tools',
  minimap: 'Overview',
  tools: Object.freeze({
    select: 'Select (V)',
    hand: 'Pan (H)',
    rect: 'Rectangle (R)',
    ellipse: 'Ellipse (O)',
    diamond: 'Diamond (D)',
    line: 'Line (L)',
    arrow: 'Arrow (A)',
    draw: 'Draw (P)',
    text: 'Text (T)',
    sticky: 'Sticky note (S)',
    frame: 'Frame (F)',
    connector: 'Connector (C)',
  }),
  undo: 'Undo',
  redo: 'Redo',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Zoom to fit',
  remove: 'Delete',
  group: 'Group',
  ungroup: 'Ungroup',
  editText: 'Edit text',
  kinds: Object.freeze({
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    diamond: 'Diamond',
    line: 'Line',
    arrow: 'Arrow',
    path: 'Drawing',
    text: 'Text',
    sticky: 'Sticky note',
    image: 'Image',
    frame: 'Frame',
    group: 'Group',
  }),
  connector: 'Connector from {name} to {target}',
  selected: (v: CanvasLabelValues) =>
    v.count === 1 ? `Selected ${v.name ?? 'shape'}.` : `Selected ${v.count ?? 0} shapes.`,
  selectionCleared: 'Selection cleared.',
  moved: 'Moved {name} to {x}, {y}.',
  resized: 'Resized {name} to {width} by {height}.',
  rotated: 'Rotated {name} to {degrees} degrees.',
  added: 'Added {name}.',
  removed: (v: CanvasLabelValues) =>
    v.count === 1 ? 'Deleted 1 item.' : `Deleted ${v.count ?? 0} items.`,
  grouped: 'Grouped {count} shapes.',
  ungrouped: 'Ungrouped {count} shapes.',
  connectStart: 'Connecting from {name}. Tab to a shape and press Enter, or Escape to cancel.',
  connectTarget: 'Connect to {name}?',
  connected: 'Connected {name} to {target}.',
  connectCancelled: 'Connection cancelled.',
  copied: (v: CanvasLabelValues) =>
    v.count === 1 ? 'Copied 1 shape.' : `Copied ${v.count ?? 0} shapes.`,
  pasted: (v: CanvasLabelValues) =>
    v.count === 1 ? 'Pasted 1 shape.' : `Pasted ${v.count ?? 0} shapes.`,
  pasteRefused: 'Nothing to paste: the clipboard holds no valid canvas shapes.',
  undone: 'Undone.',
  redone: 'Redone.',
  zoomed: 'Zoom {percent}%.',
  toolChosen: '{tool}.',
  reordered: 'Changed the stacking order.',
  refused: 'That change is not allowed here.',
  editing: 'Editing the text of {name}. Escape finishes.',
  empty: 'The canvas is empty.',
  imageMissing: 'Image unavailable: {name}',
}) as CanvasLabels;

/** Merge overrides over the defaults. */
export function resolveCanvasLabels(overrides: CanvasLabelOverrides = {}): CanvasLabels {
  return {
    ...DEFAULT_CANVAS_LABELS,
    ...overrides,
    tools: { ...DEFAULT_CANVAS_LABELS.tools, ...overrides.tools },
    kinds: { ...DEFAULT_CANVAS_LABELS.kinds, ...overrides.kinds },
  } as CanvasLabels;
}

/** Fill a template (`{name}` placeholders) or call a label function. */
export function formatCanvasLabel(
  label: CanvasLabel | undefined,
  values: CanvasLabelValues = {}
): string {
  if (label === undefined) return '';
  if (typeof label === 'function') return label(values);
  return label.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key as keyof CanvasLabelValues];
    return value === undefined ? '' : String(value);
  });
}
