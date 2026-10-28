import {
  flipArrowForDirection,
  isActivationKey,
  isComposing,
  type KeyboardEventLike,
} from '@texuli/core/keyboard';
import type { DragIntent, Orientation, TextDirection } from '@texuli/drag';

export interface SortableKeyOptions {
  readonly orientation?: Orientation;
  readonly direction?: TextDirection;
  /** Tree lists: the cross-axis arrows nest (`moveInto`) and un-nest (`moveOut`). */
  readonly nested?: boolean;
  /** Whether this item is being dragged. */
  readonly dragging: boolean;
}

/**
 * The drag intent for a key on a handle, through `@texuli/core/keyboard`:
 * Space or Enter picks up and drops, Escape and Tab cancel, arrows move
 * (inline arrows flip in right-to-left text). Null for every other key,
 * for composing keys, and for arrows held with Ctrl, Meta or Alt.
 */
export function sortableIntent(
  event: KeyboardEventLike,
  options: SortableKeyOptions
): DragIntent | null {
  if (isComposing(event)) return null;
  if (isActivationKey(event)) return options.dragging ? 'drop' : 'pickUp';
  if (!options.dragging) return null;
  // Arrows held with a command modifier belong to the platform or the host.
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = flipArrowForDirection(event.key, options.direction ?? 'ltr');
  if (key === 'Escape' || key === 'Tab') return 'cancel';
  const orientation = options.orientation ?? 'vertical';
  if (orientation === 'vertical') {
    if (key === 'ArrowUp') return 'movePrev';
    if (key === 'ArrowDown') return 'moveNext';
    if (options.nested && key === 'ArrowRight') return 'moveInto';
    if (options.nested && key === 'ArrowLeft') return 'moveOut';
    return null;
  }
  if (key === 'ArrowLeft') return 'movePrev';
  if (key === 'ArrowRight') return 'moveNext';
  if (orientation === 'grid') {
    if (key === 'ArrowUp') return 'movePrev';
    if (key === 'ArrowDown') return 'moveNext';
  } else if (options.nested) {
    if (key === 'ArrowDown') return 'moveInto';
    if (key === 'ArrowUp') return 'moveOut';
  }
  return null;
}
