/**
 * Keyboard model for dashboard widgets, consistent with the `@texuli/drag`
 * contract (APG-style grab and drop on a handle button):
 *
 * - On a move or resize handle, Space or Enter picks the widget up.
 * - While picked up, the arrow keys move it one column or row (or, on the
 *   resize handle, make it one column wider or narrower and one row taller
 *   or shorter). Left and right flip in right-to-left text.
 * - Space or Enter drops (keeps the change); Escape cancels and restores the
 *   widget; Tab cancels too, and focus moves on as usual.
 */

/** The keyboard fields the model reads (a KeyboardEvent satisfies it). */
export interface DashboardKeyLike {
  readonly key: string;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}

export type DashboardKeyIntent =
  | { readonly type: 'grab' }
  | { readonly type: 'drop' }
  | { readonly type: 'cancel'; readonly keepFocusMove: boolean }
  | { readonly type: 'step'; readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1 };

/**
 * The intent for a key press on a handle, or `null` when the key is not the
 * dashboard's (the caller then leaves the event alone). `active` is true
 * while the widget is picked up.
 */
export function dashboardKeyIntent(
  event: DashboardKeyLike,
  state: { readonly active: boolean; readonly dir?: 'ltr' | 'rtl' }
): DashboardKeyIntent | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const key = event.key;
  if (!state.active) return key === ' ' || key === 'Enter' ? { type: 'grab' } : null;
  const flip = state.dir === 'rtl' ? -1 : 1;
  switch (key) {
    case ' ':
    case 'Enter':
      return { type: 'drop' };
    case 'Escape':
      return { type: 'cancel', keepFocusMove: false };
    case 'Tab':
      return { type: 'cancel', keepFocusMove: true };
    case 'ArrowLeft':
      return { type: 'step', dx: flip === 1 ? -1 : 1, dy: 0 };
    case 'ArrowRight':
      return { type: 'step', dx: flip === 1 ? 1 : -1, dy: 0 };
    case 'ArrowUp':
      return { type: 'step', dx: 0, dy: -1 };
    case 'ArrowDown':
      return { type: 'step', dx: 0, dy: 1 };
    default:
      return null;
  }
}

/**
 * The cell a pointer drag points at: the widget's start cell plus the
 * pointer travel in whole cells (rounded), with the inline axis flipped in
 * right-to-left text. `cell` is one column's width plus the gap, and one
 * row's height plus the gap, in CSS pixels.
 */
export function cellFromDelta(
  start: { readonly x: number; readonly y: number },
  delta: { readonly x: number; readonly y: number },
  cell: { readonly width: number; readonly height: number },
  dir: 'ltr' | 'rtl' = 'ltr'
): { x: number; y: number } {
  const across = cell.width > 0 && Number.isFinite(delta.x) ? Math.round(delta.x / cell.width) : 0;
  const down = cell.height > 0 && Number.isFinite(delta.y) ? Math.round(delta.y / cell.height) : 0;
  return { x: start.x + (dir === 'rtl' ? -across : across), y: start.y + down };
}
