/**
 * The canvas keyboard model as data: a key event in, a command out (or
 * `null` to let the key through). Pure, so the whole map is unit tested
 * and documented in one place.
 */

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'draw'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'connector';

export const CANVAS_TOOLS: readonly CanvasTool[] = Object.freeze([
  'select',
  'hand',
  'rect',
  'ellipse',
  'diamond',
  'line',
  'arrow',
  'draw',
  'text',
  'sticky',
  'frame',
  'connector',
]);

/** Single-letter tool shortcuts (no modifier). */
export const TOOL_KEYS: Readonly<Record<string, CanvasTool>> = Object.freeze({
  v: 'select',
  h: 'hand',
  r: 'rect',
  o: 'ellipse',
  d: 'diamond',
  l: 'line',
  a: 'arrow',
  p: 'draw',
  t: 'text',
  s: 'sticky',
  f: 'frame',
  c: 'connector',
});

export type Direction = 'left' | 'right' | 'up' | 'down';

export type CanvasCommand =
  | { kind: 'next' }
  | { kind: 'previous' }
  | { kind: 'move'; direction: Direction; fine: boolean }
  | { kind: 'resize'; direction: Direction; fine: boolean }
  | { kind: 'rotate'; degrees: number }
  | { kind: 'edit' }
  | { kind: 'toggle' }
  | { kind: 'remove' }
  | { kind: 'group' }
  | { kind: 'ungroup' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'copy' }
  | { kind: 'cut' }
  | { kind: 'paste' }
  | { kind: 'duplicate' }
  | { kind: 'selectAll' }
  | { kind: 'escape' }
  | { kind: 'zoomIn' }
  | { kind: 'zoomOut' }
  | { kind: 'zoomReset' }
  | { kind: 'fit' }
  | { kind: 'zoomSelection' }
  | { kind: 'reorder'; mode: 'front' | 'back' | 'forward' | 'backward' }
  | { kind: 'connect' }
  | { kind: 'tool'; tool: CanvasTool }
  | { kind: 'create' };

export interface KeyLike {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/**
 * Map a key to a command. `target` says what has focus: a `shape`, or the
 * `surface` itself (nothing focused inside). Arrow keys move shapes in
 * world space, so right-to-left does not mirror them: the arrow you press is
 * the way the shape goes on screen.
 */
export function canvasCommand(
  event: KeyLike,
  target: 'shape' | 'surface' = 'shape'
): CanvasCommand | null {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const key = event.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (mod) {
    if (lower === 'z') return event.shiftKey ? { kind: 'redo' } : { kind: 'undo' };
    if (lower === 'y') return { kind: 'redo' };
    if (lower === 'g') return event.shiftKey ? { kind: 'ungroup' } : { kind: 'group' };
    if (lower === 'c') return { kind: 'copy' };
    if (lower === 'x') return { kind: 'cut' };
    if (lower === 'v') return { kind: 'paste' };
    if (lower === 'd') return { kind: 'duplicate' };
    if (lower === 'a') return { kind: 'selectAll' };
    if (key === ']') return { kind: 'reorder', mode: event.shiftKey ? 'front' : 'forward' };
    if (key === '[') return { kind: 'reorder', mode: event.shiftKey ? 'back' : 'backward' };
    return null;
  }
  if (key === 'Tab') return event.shiftKey ? { kind: 'previous' } : { kind: 'next' };
  const direction = ARROWS[key];
  if (direction) {
    if (event.shiftKey) return { kind: 'resize', direction, fine: event.altKey === true };
    return { kind: 'move', direction, fine: event.altKey === true };
  }
  if (key === 'Escape') return { kind: 'escape' };
  if (key === '+' || key === '=') return { kind: 'zoomIn' };
  if (key === '-' || key === '_') return { kind: 'zoomOut' };
  if (key === '0') return { kind: 'zoomReset' };
  if (key === '1' && event.shiftKey !== true) return { kind: 'fit' };
  if (key === '2' && event.shiftKey !== true) return { kind: 'zoomSelection' };
  if (event.altKey) return null;
  if (target === 'shape') {
    if (key === 'Enter' || key === 'F2') return { kind: 'edit' };
    if (key === ' ') return { kind: 'toggle' };
    if (key === 'Delete' || key === 'Backspace') return { kind: 'remove' };
    if (key === ']') return { kind: 'rotate', degrees: event.shiftKey ? 1 : 15 };
    if (key === '[') return { kind: 'rotate', degrees: event.shiftKey ? -1 : -15 };
    if (lower === 'k') return { kind: 'connect' };
  } else if (key === 'Enter') return { kind: 'create' };
  const tool = TOOL_KEYS[lower];
  if (tool && !event.shiftKey) return { kind: 'tool', tool };
  return null;
}

/** Arrow direction as a world delta of `step` units. */
export function directionDelta(direction: Direction, step: number): { x: number; y: number } {
  if (direction === 'left') return { x: -step, y: 0 };
  if (direction === 'right') return { x: step, y: 0 };
  if (direction === 'up') return { x: 0, y: -step };
  return { x: 0, y: step };
}
