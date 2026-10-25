/**
 * Presence: keep a node "mounted" until its exit transition or animation ends.
 *
 * Framework-free. Controllers take an element explicitly; reduced motion is
 * read through a supplied window (or the node's owner window). No module-scope
 * browser access.
 */

import { getOwnerWindow, listen, matchesMedia, requestFrame } from '../env/index.ts';

/** Value written to `data-state` while the presence machine runs. */
export type PresenceState = 'open' | 'closed';

/** Attribute name used for open/closed styling hooks. */
export const PRESENCE_STATE_ATTR = 'data-state';

/** Media query that opts out of exit waits. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Immutable view of the presence machine. */
export type PresenceSnapshot = {
  /** Whether consumers should keep the node in the DOM. */
  readonly mounted: boolean;
  /** `data-state` value: open while present, closed while exiting or hidden. */
  readonly state: PresenceState;
  /** True between `setPresent(false)` and the exit completing. */
  readonly exiting: boolean;
  /** Last present intent from the caller. */
  readonly present: boolean;
};

export type PresenceHooks = {
  /** Fires when the snapshot changes. */
  onSnapshot?: (snapshot: PresenceSnapshot) => void;
  /** Fires when the machine enters the open/mounted path. */
  onEnter?: (snapshot: PresenceSnapshot) => void;
  /** Fires when exit finishes and the node may unmount (or forceMount stays). */
  onExitComplete?: (snapshot: PresenceSnapshot) => void;
};

export type CreatePresenceOptions = PresenceHooks & {
  /** Initial present intent. Default `false`. */
  present?: boolean;
  /**
   * Keep the node mounted even after exit completes. `data-state` still flips
   * to `closed`. Default `false`.
   */
  forceMount?: boolean;
  /**
   * Skip waiting for CSS motion on exit. Also true when reduced motion is
   * detected (unless overridden).
   */
  skipExitAnimation?: boolean;
  /**
   * Force reduced-motion behavior. When omitted, the controller reads
   * `prefers-reduced-motion` from the attached node's window (or `ownerWindow`).
   */
  reducedMotion?: boolean;
  /**
   * Window used for media queries and frames when no node is attached yet.
   * SSR-safe: omit on the server.
   */
  ownerWindow?: Pick<
    Window,
    'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame'
  > | null;
  /**
   * Override for “does this node still have CSS motion?”. Defaults to
   * {@link hasPendingMotion}. Tests inject a stub when the environment’s
   * `getComputedStyle` cannot report durations.
   */
  isMotionPending?: (element: Element) => boolean;
};

export type PresenceController = {
  /** Current snapshot. */
  getSnapshot: () => PresenceSnapshot;
  /** Drive open/closed intent. */
  setPresent: (present: boolean) => void;
  /**
   * Attach the animated element so exit can listen for `transitionend` /
   * `animationend` and so `data-state` can be written.
   */
  setNode: (node: HTMLElement | null) => void;
  /** Finish an in-flight exit without waiting for motion events. */
  completeExit: () => void;
  /** Write `data-state` on the given node (or the attached one). */
  syncAttributes: (node?: HTMLElement | null) => void;
  /** Tear down listeners and pending frames. */
  dispose: () => void;
};

/**
 * Whether the given window (or SSR default) prefers reduced motion.
 * Does not read ambient globals; pass the owner window explicitly.
 */
export function prefersReducedMotion(
  ownerWindow?: Pick<Window, 'matchMedia'> | null,
  ssrDefault = false
): boolean {
  return matchesMedia(REDUCED_MOTION_QUERY, ownerWindow, ssrDefault);
}

/**
 * Parse a CSS time list (`"0.2s, 0ms"`) into milliseconds. Invalid tokens are 0.
 */
export function parseCssTimeList(value: string): number[] {
  if (!value || value.trim() === '') return [0];
  return value.split(',').map((token) => {
    const t = token.trim().toLowerCase();
    if (t.endsWith('ms')) {
      const n = Number.parseFloat(t.slice(0, -2));
      return Number.isFinite(n) ? n : 0;
    }
    if (t.endsWith('s')) {
      const n = Number.parseFloat(t.slice(0, -1));
      return Number.isFinite(n) ? n * 1000 : 0;
    }
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  });
}

/**
 * True when the element still has a non-zero CSS transition or animation
 * duration (including delay). Uses `getComputedStyle` on the element.
 */
export function hasPendingMotion(element: Element): boolean {
  const style = getComputedStyle(element);
  const durations = [
    ...parseCssTimeList(style.transitionDuration),
    ...parseCssTimeList(style.animationDuration),
  ];
  const delays = [
    ...parseCssTimeList(style.transitionDelay),
    ...parseCssTimeList(style.animationDelay),
  ];
  const max = Math.max(0, ...durations.map((d, i) => d + (delays[i] ?? delays[0] ?? 0)));
  return max > 0;
}

function snapshotOf(
  present: boolean,
  mounted: boolean,
  state: PresenceState,
  exiting: boolean
): PresenceSnapshot {
  return { present, mounted, state, exiting };
}

/**
 * Create a presence controller. Call `setNode` with the animated element once
 * it is in the DOM. Drive open/close with `setPresent`.
 *
 * @example
 * const presence = createPresence({
 *   present: true,
 *   onExitComplete: () => { /* unmount in the framework binding *\/ },
 * });
 * presence.setNode(panelEl);
 * presence.setPresent(false); // data-state=closed, then unmount after motion
 */
export function createPresence(options: CreatePresenceOptions = {}): PresenceController {
  let present = options.present === true;
  const forceMount = options.forceMount === true;
  const skipExitAnimation = options.skipExitAnimation === true;
  const reducedMotionOverride = options.reducedMotion;
  const ownerWindow = options.ownerWindow ?? null;
  const isMotionPending = options.isMotionPending ?? hasPendingMotion;

  let node: HTMLElement | null = null;
  let mounted = present || forceMount;
  let state: PresenceState = present ? 'open' : 'closed';
  let exiting = false;

  let stopMotion: (() => void) | null = null;
  let cancelFrame: (() => void) | null = null;
  let disposed = false;

  const hooks: PresenceHooks = {
    onSnapshot: options.onSnapshot,
    onEnter: options.onEnter,
    onExitComplete: options.onExitComplete,
  };

  function current(): PresenceSnapshot {
    return snapshotOf(present, mounted, state, exiting);
  }

  function emit(prev: PresenceSnapshot, kind?: 'enter' | 'exitComplete'): void {
    const next = current();
    hooks.onSnapshot?.(next);
    if (kind === 'enter') hooks.onEnter?.(next);
    if (kind === 'exitComplete') hooks.onExitComplete?.(next);
    void prev;
  }

  function resolveWindow(): typeof ownerWindow {
    if (ownerWindow) return ownerWindow;
    if (node) return getOwnerWindow(node) ?? null;
    return null;
  }

  function shouldSkipExit(): boolean {
    if (skipExitAnimation) return true;
    if (reducedMotionOverride === true) return true;
    if (reducedMotionOverride === false) return false;
    return prefersReducedMotion(resolveWindow(), false);
  }

  function clearExitWait(): void {
    stopMotion?.();
    stopMotion = null;
    cancelFrame?.();
    cancelFrame = null;
  }

  function writeStateAttr(target: HTMLElement | null | undefined = node): void {
    if (!target) return;
    target.setAttribute(PRESENCE_STATE_ATTR, state);
  }

  function finishExit(): void {
    if (disposed || !exiting) return;
    clearExitWait();
    exiting = false;
    state = 'closed';
    if (!forceMount) {
      mounted = false;
    }
    writeStateAttr();
    emit(current(), 'exitComplete');
  }

  function watchExitMotion(target: HTMLElement): void {
    clearExitWait();

    if (shouldSkipExit() || !isMotionPending(target)) {
      // Apply closed styles first, then complete on the next frame so CSS can
      // paint one closed frame when durations are zero.
      cancelFrame = requestFrame(() => {
        cancelFrame = null;
        finishExit();
      }, resolveWindow());
      return;
    }

    const onEnd = (event: Event): void => {
      if (event.target !== target) return;
      // First animation/transition end on the node completes presence.
      finishExit();
    };

    const stopTransition = listen(target, 'transitionend', onEnd as EventListener);
    const stopAnimation = listen(target, 'animationend', onEnd as EventListener);
    stopMotion = () => {
      stopTransition();
      stopAnimation();
    };
  }

  function beginExit(): void {
    if (exiting) return;
    const prev = current();
    exiting = true;
    state = 'closed';
    mounted = true;
    writeStateAttr();
    emit(prev);

    if (!node) {
      finishExit();
      return;
    }
    watchExitMotion(node);
  }

  function enter(): void {
    clearExitWait();
    const wasMounted = mounted;
    const prev = current();
    exiting = false;
    present = true;
    mounted = true;
    state = 'open';
    writeStateAttr();
    emit(prev, wasMounted && prev.state === 'open' ? undefined : 'enter');
  }

  const controller: PresenceController = {
    getSnapshot: () => current(),

    setPresent(nextPresent: boolean): void {
      if (disposed) return;

      if (nextPresent) {
        if (present && mounted && state === 'open' && !exiting) return;
        enter();
        return;
      }

      present = false;
      if (exiting) return;
      if (!mounted) {
        state = 'closed';
        writeStateAttr();
        emit(current());
        return;
      }
      if (state === 'closed' && forceMount) return;
      beginExit();
    },

    setNode(next: HTMLElement | null): void {
      if (disposed) return;
      node = next;
      writeStateAttr(next);
      if (exiting && next) {
        watchExitMotion(next);
      } else if (exiting && !next) {
        finishExit();
      }
    },

    completeExit(): void {
      if (disposed) return;
      if (!exiting) {
        if (!present && mounted && !forceMount) {
          exiting = true;
          finishExit();
        }
        return;
      }
      finishExit();
    },

    syncAttributes(target?: HTMLElement | null): void {
      writeStateAttr(target === undefined ? node : target);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearExitWait();
      node = null;
    },
  };

  // Initial attribute write when a consumer attaches later; snapshot is ready.
  if (mounted) {
    writeStateAttr();
  }

  return controller;
}
