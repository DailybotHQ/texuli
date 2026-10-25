/**
 * Player keyboard policy (P3 phase 0-1). The player owns only frame-level
 * keys; plain arrows, Enter and Space inside a component stay with that
 * component.
 *
 * - Tab order is DOM order, which is reading order: the player never
 *   reorders nodes, and positive `tabindex` values in painted content are
 *   normalized to `0` (the catalog grammar refuses visual-order props too).
 * - Layout frames are focus stops (`data-tx-player-frame`, `tabindex="-1"`).
 *   F6 / Shift+F6 cycle through all of them in reading order. When a frame
 *   itself has focus, arrows rove the frame tree the grammar's containers
 *   form: ArrowDown / ArrowUp / Home / End among sibling frames,
 *   ArrowRight into the first child frame, ArrowLeft to the parent frame
 *   (Left and Right swap in right-to-left content).
 * - Containment: frames inside an `inert` subtree (a component's modal
 *   surface making the rest inert, an inactive player) are never targets.
 * - Escape walks focus outward: from inside a frame to that frame, from a
 *   frame to the player label. It never traps, and it leaves an Escape that
 *   a component (a dialog, a menu) already handled alone.
 */

/** Attribute that marks a frame focus stop inside the surface. */
export const FRAME_ATTRIBUTE = 'data-tx-player-frame';

/** Frame stops under `root`, in DOM (reading) order. */
export function frameStops(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${FRAME_ATTRIBUTE}]`));
}

/** Frames focus can move to: not inside an `inert` subtree. */
export function navigableFrames(root: ParentNode): HTMLElement[] {
  return frameStops(root).filter((frame) => frame.closest('[inert]') === null);
}

/** The nearest frame that encloses `frame` within `surface`, or `null` for a top-level frame. */
export function parentFrame(frame: Element, surface: Element): HTMLElement | null {
  const parent = frame.parentElement?.closest<HTMLElement>(`[${FRAME_ATTRIBUTE}]`) ?? null;
  return parent && surface.contains(parent) ? parent : null;
}

/**
 * Set every positive `tabindex` under `root` to `0`, so painted content
 * cannot pull focus out of reading order. Returns how many changed.
 */
export function normalizeTabOrder(root: ParentNode): number {
  let changed = 0;
  for (const element of root.querySelectorAll<HTMLElement>('[tabindex]')) {
    const value = Number.parseInt(element.getAttribute('tabindex') ?? '', 10);
    if (value > 0) {
      element.setAttribute('tabindex', '0');
      changed += 1;
    }
  }
  return changed;
}

/** Whether Escape at `target` belongs to an open modal surface rather than the player. */
function insideModal(target: Element, surface: Element): boolean {
  const modal = target.closest('[aria-modal="true"], dialog[open]');
  return modal !== null && surface.contains(modal);
}

function focus(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  element.focus();
  return true;
}

export interface SurfaceKeyContext {
  /** The painted surface (frames live under it). */
  surface: HTMLElement;
  /** Where Escape lands when focus is already on a frame (the player label). */
  outer: HTMLElement | null;
}

/**
 * Handle one keydown inside the surface. Returns `true` when the player
 * acted (and prevented the default), `false` when the key is the
 * component's or the browser's.
 */
export function handleSurfaceKeydown(event: KeyboardEvent, context: SurfaceKeyContext): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !context.surface.contains(target)) return false;
  const frames = navigableFrames(context.surface);
  const onFrame = target.hasAttribute(FRAME_ATTRIBUTE);
  const current = onFrame ? target : target.closest<HTMLElement>(`[${FRAME_ATTRIBUTE}]`);
  const index = current ? frames.indexOf(current) : -1;

  let moved = false;
  if (event.key === 'F6') {
    if (frames.length === 0) return false;
    const step = event.shiftKey ? -1 : 1;
    const start = index < 0 ? (step > 0 ? -1 : 0) : index;
    moved = focus(frames[(start + step + frames.length) % frames.length]);
  } else if (event.key === 'Escape') {
    if (insideModal(target, context.surface)) return false;
    moved = onFrame || !current ? focus(context.outer) : focus(current);
  } else if (onFrame && current && !event.shiftKey) {
    const parent = parentFrame(current, context.surface);
    const siblings = frames.filter((frame) => parentFrame(frame, context.surface) === parent);
    const at = siblings.indexOf(current);
    const rtl = current.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const inward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const outward = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === 'ArrowDown') moved = focus(siblings[at + 1]);
    else if (event.key === 'ArrowUp') moved = focus(siblings[at - 1]);
    else if (event.key === 'Home') moved = focus(siblings[0]);
    else if (event.key === 'End') moved = focus(siblings[siblings.length - 1]);
    else if (event.key === inward) {
      moved = focus(frames.find((frame) => parentFrame(frame, context.surface) === current));
    } else if (event.key === outward) {
      moved = focus(parent && frames.includes(parent) ? parent : null);
    }
  }
  if (moved) event.preventDefault();
  return moved;
}
