/**
 * The open-state machine behind NavigationMenu, free of the DOM so its timing
 * can be tested. One item at most is open (`value`, or `''` for none).
 *
 * - Pointer: hovering a trigger opens its item after `delayDuration`. While a
 *   menu is open, and for `skipDelayDuration` after one closes, moving to
 *   another trigger switches at once. Leaving the trigger and its content
 *   closes after a short grace period that entering either cancels.
 * - Click: toggles the item. An item opened by a click stays open when the
 *   pointer leaves; an outside press, Escape or focus leaving closes it.
 */
export interface NavigationMenuControllerOptions {
  delayDuration?: number;
  skipDelayDuration?: number;
  /** Grace period before a hovered item closes after the pointer leaves. */
  closeDelay?: number;
  onChange: (value: string) => void;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface NavigationMenuController {
  readonly value: string;
  /** Whether the open item was opened by a click (hover-leave does not close it). */
  readonly sticky: boolean;
  setValue(value: string, options?: { sticky?: boolean }): void;
  toggle(value: string): void;
  close(): void;
  pointerEnterTrigger(value: string): void;
  pointerLeave(): void;
  pointerEnterContent(): void;
  /** Sync from a controlled `value` without notifying. */
  sync(value: string): void;
  destroy(): void;
}

export function createNavigationMenuController(
  options: NavigationMenuControllerOptions
): NavigationMenuController {
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const delay = () => Math.max(0, options.delayDuration ?? 200);
  const skip = () => Math.max(0, options.skipDelayDuration ?? 300);
  const closeDelay = () => Math.max(0, options.closeDelay ?? 150);

  let value = '';
  let sticky = false;
  let openTimer: unknown = null;
  let closeTimer: unknown = null;
  let skipTimer: unknown = null;
  let skipping = false;

  const cancel = (timer: unknown) => {
    if (timer !== null) clearTimer(timer);
    return null;
  };

  function commit(next: string, nextSticky: boolean): void {
    openTimer = cancel(openTimer);
    closeTimer = cancel(closeTimer);
    sticky = next !== '' && nextSticky;
    if (next === value) return;
    const wasOpen = value !== '';
    value = next;
    if (next === '' && wasOpen) {
      // A menu just closed: hovering another trigger soon opens it at once.
      skipping = true;
      skipTimer = cancel(skipTimer);
      skipTimer = setTimer(() => {
        skipping = false;
        skipTimer = null;
      }, skip());
    }
    options.onChange(next);
  }

  return {
    get value() {
      return value;
    },
    get sticky() {
      return sticky;
    },
    setValue(next, { sticky: nextSticky = false } = {}) {
      commit(next, nextSticky);
    },
    toggle(item) {
      commit(value === item && sticky ? '' : item, true);
    },
    close() {
      commit('', false);
    },
    pointerEnterTrigger(item) {
      closeTimer = cancel(closeTimer);
      if (value === item) return;
      if (value !== '' || skipping || delay() === 0) {
        commit(item, false);
        return;
      }
      openTimer = cancel(openTimer);
      openTimer = setTimer(() => commit(item, false), delay());
    },
    pointerLeave() {
      openTimer = cancel(openTimer);
      if (value === '' || sticky) return;
      closeTimer = cancel(closeTimer);
      closeTimer = setTimer(() => commit('', false), closeDelay());
    },
    pointerEnterContent() {
      closeTimer = cancel(closeTimer);
    },
    sync(next) {
      if (next === value) return;
      openTimer = cancel(openTimer);
      closeTimer = cancel(closeTimer);
      value = next;
      if (next === '') sticky = false;
    },
    destroy() {
      openTimer = cancel(openTimer);
      closeTimer = cancel(closeTimer);
      skipTimer = cancel(skipTimer);
    },
  };
}

/** Which way content moves when the open item changes (for enter animations). */
export function motionBetween(
  previous: string,
  next: string,
  order: readonly string[]
): 'from-start' | 'from-end' | undefined {
  if (!previous || !next || previous === next) return undefined;
  const from = order.indexOf(previous);
  const to = order.indexOf(next);
  if (from < 0 || to < 0) return undefined;
  return to > from ? 'from-end' : 'from-start';
}
