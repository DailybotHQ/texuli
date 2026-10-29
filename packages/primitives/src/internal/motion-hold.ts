/**
 * Exit motion for overlay parts (ADR-013). A primitive on its own animates
 * nothing and unmounts a closed part at once, as before. A styled layer
 * (texuli, through `texuli/motion`) passes `motionHooks`: `enter` plays after
 * the part opens, and the hold `exit` returns keeps the closed part mounted,
 * `inert` and `data-state="closed"`, until its animation settles (at most
 * {@link MOTION_HOLD_MAX_MS}).
 *
 * Interaction is released when the part closes, not when the exit ends: the
 * overlay engine restores focus, lifts `inert` from the page and leaves the
 * layer stack at once; only the paint (the top layer, the scroll lock) waits
 * for the unmount.
 */

import { hasPendingMotion } from '@texuli/core/presence';

/** An exit in flight: the part unmounts once `finished` settles. */
export interface OverlayMotionHold {
  readonly finished: Promise<unknown>;
  cancel(): void;
}

/** What an overlay part's `motionHooks` prop takes. */
export interface OverlayMotionHooks {
  /** After the part opens (not for a part already open when it is created). */
  enter?: (node: HTMLElement) => void;
  /** When it closes: return a hold to keep it mounted until the exit ends. */
  exit?: (node: HTMLElement) => OverlayMotionHold | null | undefined;
}

/** A closed part goes after this even if its exit never reports (ms). */
export const MOTION_HOLD_MAX_MS = 1_200;

export interface MotionHoldController {
  /** Whether a closed part is being kept for its exit. */
  held(): boolean;
  /** The part closed: start its exit; `true` when it is held. */
  begin(node: HTMLElement | null | undefined): boolean;
  /** The part opened: stop a running exit and play the enter. */
  enter(node: HTMLElement | null | undefined): void;
  /** Drop a running exit (the part reopened or unmounts). */
  cancel(): void;
  /** For the overlay engine: wait while held, else read the CSS motion as before. */
  isMotionPending(element: Element): boolean;
}

export function createMotionHold(
  hooks: () => OverlayMotionHooks | null | undefined,
  onHeldChange: (held: boolean) => void
): MotionHoldController {
  let active: OverlayMotionHold | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function settle(hold: OverlayMotionHold): void {
    if (active !== hold) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    active = null;
    onHeldChange(false);
  }

  function cancel(): void {
    const hold = active;
    if (!hold) return;
    settle(hold);
    try {
      hold.cancel();
    } catch {
      // A hold that cannot cancel is dropped all the same.
    }
  }

  return {
    held: () => active !== null,
    begin(node) {
      if (active) return true;
      if (!node?.isConnected) return false;
      let hold: OverlayMotionHold | null | undefined = null;
      try {
        hold = hooks()?.exit?.(node);
      } catch {
        hold = null;
      }
      if (!hold) return false;
      const current = hold;
      active = current;
      timer = setTimeout(() => settle(current), MOTION_HOLD_MAX_MS);
      void Promise.resolve(current.finished).then(
        () => settle(current),
        () => settle(current)
      );
      onHeldChange(true);
      return true;
    },
    enter(node) {
      cancel();
      if (!node) return;
      try {
        hooks()?.enter?.(node);
      } catch {
        // Motion never breaks opening.
      }
    },
    cancel,
    isMotionPending: (element) => active !== null || hasPendingMotion(element),
  };
}

export interface BackdropPresence {
  /** Feed the dialog's open state (from its `subscribeOpen`). */
  setOpen(open: boolean, node: HTMLElement | null): void;
  /** For `registerBackdrop`: shown while open and while the exit plays. */
  subscribeVisible(listener: (visible: boolean) => void): () => void;
  /** Drop a running exit (the backdrop unmounts). */
  dispose(): void;
}

/**
 * A dialog backdrop's presence: shown (top layer included) while open, and
 * while its exit plays after it closed. `onChange` reports the open state and
 * whether a closed backdrop is held for its exit.
 */
export function createBackdropPresence(options: {
  open: boolean;
  hooks: () => OverlayMotionHooks | null | undefined;
  onChange: (open: boolean, held: boolean) => void;
}): BackdropPresence {
  let open = options.open;
  let held = false;
  // Open when it is created (first render, hydration): no enter animation.
  let appeared = open;
  let visible = open;
  const listeners = new Set<(visible: boolean) => void>();
  const setVisible = (next: boolean) => {
    if (visible === next) return;
    visible = next;
    for (const listener of listeners) listener(next);
  };
  const hold = createMotionHold(options.hooks, (next) => {
    held = next;
    options.onChange(open, held);
    if (!next && !open) setVisible(false);
  });
  return {
    setOpen(next, node) {
      if (next === open) return;
      open = next;
      options.onChange(open, held);
      if (next) {
        setVisible(true);
        if (appeared) appeared = false;
        else hold.enter(node);
        return;
      }
      appeared = false;
      if (!hold.begin(node)) setVisible(false);
    },
    subscribeVisible(listener) {
      listeners.add(listener);
      listener(visible);
      return () => listeners.delete(listener);
    },
    dispose: () => hold.cancel(),
  };
}
