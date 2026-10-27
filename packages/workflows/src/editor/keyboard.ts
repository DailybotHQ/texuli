import type { FocusDirection, TextDirection } from './geometry.ts';

/** What a key press on the canvas asks for. */
export type CanvasCommand =
  | { kind: 'focus'; direction: FocusDirection }
  | { kind: 'nudge'; direction: FocusDirection; large: boolean }
  | { kind: 'toggleSelect' }
  | { kind: 'remove' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'zoomIn' }
  | { kind: 'zoomOut' }
  | { kind: 'fit' }
  | { kind: 'selectAll' }
  | { kind: 'copy' }
  | { kind: 'cut' }
  | { kind: 'paste' }
  | { kind: 'group' }
  | { kind: 'ungroup' }
  | { kind: 'escape' }
  | { kind: 'first' }
  | { kind: 'last' };

export interface KeyLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

const ARROWS: Readonly<Record<string, FocusDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** Left and right swap in right-to-left text, so "forward" keeps its meaning. */
export function physicalDirection(direction: FocusDirection, dir: TextDirection): FocusDirection {
  if (dir === 'ltr') return direction;
  return direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction;
}

/**
 * Map a key press on a focused node to a canvas command (the graph keyboard
 * model of the drag contract). Returns undefined for keys the canvas leaves
 * alone. Control and Meta are interchangeable.
 */
export function canvasCommand(
  event: KeyLike,
  dir: TextDirection = 'ltr'
): CanvasCommand | undefined {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const arrow = ARROWS[event.key];
  if (arrow !== undefined) {
    const direction = physicalDirection(arrow, dir);
    if (event.altKey) return { kind: 'nudge', direction, large: event.shiftKey === true };
    if (!mod) return { kind: 'focus', direction };
    return undefined;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (mod) {
    if (key === 'z') return event.shiftKey ? { kind: 'redo' } : { kind: 'undo' };
    if (key === 'y') return { kind: 'redo' };
    if (key === '=' || key === '+') return { kind: 'zoomIn' };
    if (key === '-' || key === '_') return { kind: 'zoomOut' };
    if (key === 'a') return { kind: 'selectAll' };
    if (key === 'c') return { kind: 'copy' };
    if (key === 'x') return { kind: 'cut' };
    if (key === 'v') return { kind: 'paste' };
    if (key === 'g') return event.shiftKey ? { kind: 'ungroup' } : { kind: 'group' };
    return undefined;
  }
  if (event.altKey) return undefined;
  if (key === '0') return { kind: 'fit' };
  if (key === 'Delete' || key === 'Backspace') return { kind: 'remove' };
  if (key === ' ') return { kind: 'toggleSelect' };
  if (key === 'Escape') return { kind: 'escape' };
  if (key === 'Home') return { kind: 'first' };
  if (key === 'End') return { kind: 'last' };
  return undefined;
}

export type ConnectCommand = 'next' | 'previous' | 'commit' | 'cancel';

/** Keys while connect mode is on: arrows cycle the compatible ports, Enter connects, Escape cancels. */
export function connectCommand(event: KeyLike): ConnectCommand | undefined {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return 'next';
    case 'ArrowUp':
    case 'ArrowLeft':
      return 'previous';
    case 'Enter':
    case ' ':
      return 'commit';
    case 'Escape':
    case 'Tab':
      return 'cancel';
    default:
      return undefined;
  }
}
