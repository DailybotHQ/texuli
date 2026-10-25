import { createPrimitiveContext } from '../internal/context.ts';
import type { MenuFocusIntent } from '../menu/context.ts';

/** A point in client coordinates. */
export interface ContextMenuPoint {
  x: number;
  y: number;
}

/** What a context menu's root shares with its trigger. */
export interface ContextMenuContext {
  /**
   * Open (or move) the menu at `point`, focusing per `intent`. Focus returns
   * to `returnFocus` when the menu closes with restore.
   */
  openAt(point: ContextMenuPoint, intent: MenuFocusIntent, returnFocus: Element | null): void;
}

export const contextMenuContext = createPrimitiveContext<ContextMenuContext>('ContextMenu.Root');

/** How long a touch or pen press must hold still to open the menu (ms). */
export const LONG_PRESS_MS = 600;
/** How far (px) a long press may drift before it counts as a scroll or drag. */
export const LONG_PRESS_SLOP = 10;
