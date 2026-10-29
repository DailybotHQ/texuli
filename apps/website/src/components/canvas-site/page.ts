/**
 * Static copy for /canvas-page/: the status, the pieces of `@texuli/canvas`,
 * the sections, the keyboard table (the tool row is built from the
 * package's own `TOOL_KEYS`), the rules and the docs. Plain data, so the
 * page and its tests share one source (labels are text, never HTML).
 */
import type { CanvasTool } from '@texuli/canvas/editor';

/** The release `@texuli/canvas` is planned for. It is not on npm. */
export const CANVAS_RELEASE = '0.8.0';

export const CANVAS_STATUS = `In development, coming in ${CANVAS_RELEASE}: not published to npm yet.`;

export const CANVAS_PIECES: readonly { readonly name: string; readonly role: string }[] = [
  { name: 'canvas/model', role: 'format, validation, ops, history' },
  { name: 'canvas/editor', role: 'toolbar, surface, minimap, tree' },
  { name: 'canvas/viewer', role: 'read-only, structure as text' },
  { name: 'canvas/sync', role: 'CRDT sessions, presence' },
  { name: 'canvas/export', role: 'SVG and PNG' },
  { name: 'canvas/host', role: 'agent canvases in the player' },
];

export interface CanvasSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const CANVAS_SECTIONS: readonly CanvasSection[] = [
  {
    id: 'editor',
    title: 'An infinite canvas',
    summary:
      'A launch plan with one shape of every type: a frame of sticky notes, a group, a line, an arrow, a freehand stroke, text and an image reference, joined by straight, elbow and curved connectors. Pick a tool and draw, drag shapes (they snap to the grid and to each other, with guides), drop them into the frame, marquee-select, resize, rotate, connect, zoom with Control and the wheel, and undo anything.',
  },
  {
    id: 'vocabulary',
    title: 'The closed vocabulary',
    summary:
      'Shapes, tools, connector routes, caps and colors are closed lists, read here from the package itself. Colors are token names painted with the theme, never raw CSS, so a canvas follows light, dark and forced colors.',
  },
  {
    id: 'keyboard',
    title: 'Keyboard model',
    summary:
      'Everything works without a pointer. The surface is the one application region on the canvas; shapes take a roving tab stop in reading order, and the shape tree beside it lists every shape and connector for screen readers. Changes are announced.',
  },
  {
    id: 'collab',
    title: 'Two people, one canvas',
    summary:
      'Ada and Lin edit replicas of one board, synced through the in-memory adapter of @texuli/document/sync, the same CRDT the documents use. Moves, text, grouping and connectors merge in any order, and each person’s undo takes back only their own edits. Their selections travel as presence.',
  },
  {
    id: 'agents',
    title: 'Canvases as agent data',
    summary:
      'An agent sends a whole board as one canvas node of a blueprint (spec 0.8.0). The player validates it at the untrusted tier and paints it with the read-only viewer through the canvas host. A board that asks for a raw CSS paint is refused before anything paints.',
  },
  {
    id: 'safety',
    title: 'What keeps it safe',
    summary: 'Canvases are data. These hold by construction in the validator and the painters.',
  },
];

export interface CanvasKey {
  readonly keys: string;
  readonly onShape: string;
  readonly onSurface: string;
}

/** The keyboard model of packages/canvas/docs/editor.md. */
export const CANVAS_KEYS: readonly CanvasKey[] = [
  {
    keys: 'Tab, Shift+Tab',
    onShape: 'Next or previous shape in reading order; past the last, leave the canvas',
    onSurface: 'Enter the first shape',
  },
  { keys: 'Arrow keys', onShape: 'Move one grid step (Alt: one unit)', onSurface: 'Pan' },
  { keys: 'Shift+arrow keys', onShape: 'Resize', onSurface: '—' },
  { keys: '[ and ]', onShape: 'Rotate 15° (Shift: 1°)', onSurface: '—' },
  {
    keys: 'Enter or F2',
    onShape: 'Edit text in place (Escape or Ctrl/Cmd+Enter finishes)',
    onSurface: 'Create a shape of the active tool at the view center',
  },
  { keys: 'Space', onShape: 'Add to or remove from the selection', onSurface: '—' },
  { keys: 'Delete, Backspace', onShape: 'Delete the selection', onSurface: '—' },
  {
    keys: 'K',
    onShape: 'Connect: Tab to the target, Enter connects, Escape cancels',
    onSurface: '—',
  },
  { keys: 'Ctrl/Cmd+G, Ctrl/Cmd+Shift+G', onShape: 'Group, ungroup', onSurface: '—' },
  { keys: 'Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Y', onShape: 'Undo, redo', onSurface: 'Undo, redo' },
  {
    keys: 'Ctrl/Cmd+C, X, V, D, A',
    onShape: 'Copy, cut, paste, duplicate, select all',
    onSurface: 'Paste, select all',
  },
  {
    keys: 'Ctrl/Cmd+] and [',
    onShape: 'Bring forward, send backward (Shift: to the end)',
    onSurface: '—',
  },
  {
    keys: '+ and −, 0, 1, 2',
    onShape: 'Zoom in and out, 100%, fit all, fit the selection',
    onSurface: 'Same',
  },
  {
    keys: 'Escape',
    onShape:
      'Cancel connecting, clear the selection, back to the select tool, then focus the surface',
    onSurface: '—',
  },
];

/** People-facing names of the tools. Keyed by `CanvasTool`: exhaustive. */
export const TOOL_NAMES: Readonly<Record<CanvasTool, string>> = {
  select: 'Select',
  hand: 'Pan',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  line: 'Line',
  arrow: 'Arrow',
  draw: 'Draw',
  text: 'Text',
  sticky: 'Sticky note',
  frame: 'Frame',
  connector: 'Connector',
};

export const CANVAS_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Validated in linear time',
    body: 'Unknown shapes and keys, raw CSS colors, control and bidi characters in text, unknown connector ends and anything past the limits are refused, with a JSON path, in time linear in the input.',
  },
  {
    title: 'Text is text',
    body: 'Shape text paints as SVG text nodes; nothing is parsed as markup. The SVG export escapes by construction.',
  },
  {
    title: 'Images through the URL policy',
    body: 'An image is a ref the host resolves; the URL passes safeImageSrc at the tier, and a refused or missing image paints its alt text, as the board above shows.',
  },
  {
    title: 'Untrusted clipboard and sync',
    body: 'Pasted JSON is size-checked, then validated. Remote batches are validated by the sync core, and a value that fails the canvas schema drops the same way on every replica.',
  },
];

export const CANVAS_DOCS: readonly { readonly label: string; readonly path: string }[] = [
  { label: '@texuli/canvas', path: 'packages/canvas/README.md' },
  { label: 'Model', path: 'packages/canvas/docs/model.md' },
  { label: 'Editor and keyboard model', path: 'packages/canvas/docs/editor.md' },
  { label: 'Viewer', path: 'packages/canvas/docs/viewer.md' },
  { label: 'Collaboration', path: 'packages/canvas/docs/sync.md' },
  { label: 'Export', path: 'packages/canvas/docs/export.md' },
  { label: 'Agent host', path: 'packages/canvas/docs/host.md' },
];
