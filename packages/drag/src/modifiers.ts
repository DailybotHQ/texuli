import { clamp, type Point, type Rect } from './geometry.ts';

export interface ModifierContext {
  /** The dragged rect at drag start (snapshotted), when there is one. */
  readonly activeRect?: Rect | null;
}

/** Rewrites a drag translation. Compose any number with `applyModifiers`. */
export type Modifier = (delta: Point, context: ModifierContext) => Point;

/** Keeps only one axis of the translation. */
export function restrictToAxis(axis: 'x' | 'y'): Modifier {
  return (delta) => (axis === 'x' ? { x: delta.x, y: 0 } : { x: 0, y: delta.y });
}

/** Keeps the dragged rect inside `bounds` (or the translation itself when no rect). */
export function restrictToBounds(bounds: Rect | (() => Rect)): Modifier {
  return (delta, { activeRect }) => {
    const box = typeof bounds === 'function' ? bounds() : bounds;
    if (!activeRect) {
      return {
        x: clamp(delta.x, box.x, box.x + box.width),
        y: clamp(delta.y, box.y, box.y + box.height),
      };
    }
    const minX = box.x - activeRect.x;
    const minY = box.y - activeRect.y;
    const maxX = Math.max(minX, box.x + box.width - activeRect.width - activeRect.x);
    const maxY = Math.max(minY, box.y + box.height - activeRect.height - activeRect.y);
    return { x: clamp(delta.x, minX, maxX), y: clamp(delta.y, minY, maxY) };
  };
}

/** Snaps the dragged rect's corner (or the translation) to a grid. */
export function snapToGrid(size: number | { readonly x: number; readonly y: number }): Modifier {
  const gx = typeof size === 'number' ? size : size.x;
  const gy = typeof size === 'number' ? size : size.y;
  const snap = (value: number, step: number) =>
    step > 0 ? Math.round(value / step) * step : value;
  return (delta, { activeRect }) => {
    const ox = activeRect?.x ?? 0;
    const oy = activeRect?.y ?? 0;
    return { x: snap(ox + delta.x, gx) - ox, y: snap(oy + delta.y, gy) - oy };
  };
}

/** Runs modifiers left to right. */
export function applyModifiers(
  modifiers: readonly Modifier[],
  delta: Point,
  context: ModifierContext = {}
): Point {
  let result = delta;
  for (const modifier of modifiers) result = modifier(result, context);
  return result;
}

/** One modifier from many, ready for `createDragSession({ transform })`. */
export function composeModifiers(...modifiers: readonly Modifier[]): Modifier {
  return (delta, context) => applyModifiers(modifiers, delta, context);
}
