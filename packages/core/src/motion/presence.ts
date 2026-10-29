/**
 * Motion presence: enter and exit animations with interruptible reversal
 * (ADR-013), on the `@texuli/core/presence` vocabulary (`PresenceSnapshot`,
 * `data-state`).
 *
 * The core presence waits for CSS `transitionend` / `animationend`; Web
 * Animations fire neither, and an unrelated CSS transition on the node would
 * end the exit early, so this machine drives the same snapshot from its own
 * animations instead. Toggling mid-flight reverses the running animation from
 * where it is (no jump) and resolves the earlier transition `"interrupted"`.
 *
 * Nothing animates on the server or on hydration: the first attached node
 * with `present: true` shows at once unless `appear` is set.
 */

import {
  PRESENCE_STATE_ATTR,
  type PresenceSnapshot,
  type PresenceState,
} from '../presence/presence.ts';
import {
  type MotionKeyframes,
  type MotionOutcome,
  type MotionTiming,
  resolveMotion,
  startAnimation,
} from './animate.ts';

export type MotionPresenceOptions = MotionTiming & {
  /** Initial intent. Default `false`. */
  present?: boolean;
  /** Play the enter animation for a node that is present on first attach. Default `false`. */
  appear?: boolean;
  /** Keep the node mounted after exit (`data-state` still closes). Default `false`. */
  forceMount?: boolean;
  /** Enter keyframes (hidden → shown). Default a fade in. */
  enter?: MotionKeyframes;
  /** Exit keyframes (shown → hidden). Default the reverse of `enter`. */
  exit?: MotionKeyframes;
  /** Timing overrides for the exit (merged over the shared timing). */
  exitTiming?: MotionTiming;
  /** Snapshot changed. */
  onSnapshot?: (snapshot: PresenceSnapshot) => void;
  /** The enter path began (the node should be mounted). */
  onEnter?: (snapshot: PresenceSnapshot) => void;
  /** The enter animation ended (or committed instantly). */
  onEnterComplete?: (snapshot: PresenceSnapshot) => void;
  /** The exit ended; unmount when `snapshot.mounted` is false. */
  onExitComplete?: (snapshot: PresenceSnapshot) => void;
};

export type MotionPresence = {
  getSnapshot: () => PresenceSnapshot;
  /** Drive the intent; resolves when this transition settles. */
  setPresent: (present: boolean) => Promise<MotionOutcome>;
  /** Attach (or detach with `null`) the animated element after it mounts. */
  setNode: (node: Element | null) => void;
  /** The current transition's outcome (resolved `"instant"` when idle). */
  readonly finished: Promise<MotionOutcome>;
  /** Cancel any animation and stop; pending transitions resolve `"cancelled"`. */
  dispose: () => void;
};

const DEFAULT_ENTER: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

function reverseFrames(frames: MotionKeyframes): MotionKeyframes {
  if (Array.isArray(frames)) {
    return [...frames].reverse().map((frame) => {
      const { offset, ...rest } = frame;
      return typeof offset === 'number' ? { ...rest, offset: 1 - offset } : rest;
    });
  }
  const out: PropertyIndexedKeyframes = {};
  for (const [key, value] of Object.entries(frames)) {
    (out as Record<string, unknown>)[key] = Array.isArray(value) ? [...value].reverse() : value;
  }
  return out;
}

type Direction = 'enter' | 'exit';

/**
 * Create a motion presence controller.
 *
 * @example
 * const presence = createMotionPresence({
 *   enter: [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
 *   onExitComplete: (s) => { if (!s.mounted) unmount(); },
 * });
 * presence.setNode(panel);
 * await presence.setPresent(false); // "finished", or "instant" under reduced motion
 */
export function createMotionPresence(options: MotionPresenceOptions = {}): MotionPresence {
  const forceMount = options.forceMount === true;
  const enterFrames = options.enter ?? DEFAULT_ENTER;
  const exitFrames = options.exit ?? reverseFrames(enterFrames);
  const timing: MotionTiming = options;
  const exitTiming: MotionTiming = { ...options, ...options.exitTiming };

  let present = options.present === true;
  let mounted = present || forceMount;
  let state: PresenceState = present ? 'open' : 'closed';
  let exiting = false;
  let node: Element | null = null;
  let pendingEnter = present && options.appear === true;
  let animation: Animation | null = null;
  let direction: Direction | null = null;
  let disposed = false;

  let settle: ((outcome: MotionOutcome) => void) | null = null;
  let finished: Promise<MotionOutcome> = Promise.resolve('instant');

  const snapshot = (): PresenceSnapshot => ({ present, mounted, state, exiting });
  const writeAttr = (): void => {
    node?.setAttribute(PRESENCE_STATE_ATTR, state);
  };
  const emit = (): void => options.onSnapshot?.(snapshot());

  function begin(): Promise<MotionOutcome> {
    settle?.('interrupted');
    let resolve: (outcome: MotionOutcome) => void = () => {};
    finished = new Promise<MotionOutcome>((r) => {
      resolve = r;
    });
    let done = false;
    settle = (outcome) => {
      if (done) return;
      done = true;
      settle = null;
      resolve(outcome);
    };
    return finished;
  }

  function dropAnimation(): void {
    const current = animation;
    animation = null;
    direction = null;
    if (current) {
      current.onfinish = null;
      try {
        current.cancel();
      } catch {
        // Already gone.
      }
    }
  }

  function complete(dir: Direction, outcome: MotionOutcome): void {
    animation = null;
    direction = null;
    if (dir === 'exit') {
      exiting = false;
      state = 'closed';
      if (!forceMount) mounted = false;
      writeAttr();
      const s = snapshot();
      options.onSnapshot?.(s);
      options.onExitComplete?.(s);
    } else {
      options.onEnterComplete?.(snapshot());
    }
    settle?.(outcome);
  }

  function play(dir: Direction): void {
    const target = node;
    const plan = resolveMotion(
      target,
      dir === 'enter' ? enterFrames : exitFrames,
      dir === 'enter' ? timing : exitTiming
    );
    const started = !plan.instant && target ? startAnimation(target, plan) : null;
    if (!started) {
      complete(dir, 'instant');
      return;
    }
    animation = started;
    direction = dir;
    started.onfinish = () => {
      if (animation !== started || direction === null) return;
      complete(direction, 'finished');
    };
  }

  /** Reverse the running animation in place; false when there is none to reverse. */
  function reverseTo(dir: Direction): boolean {
    const current = animation;
    if (!current || direction === dir || typeof current.reverse !== 'function') return false;
    try {
      current.reverse();
    } catch {
      return false;
    }
    direction = dir;
    return true;
  }

  return {
    getSnapshot: snapshot,
    get finished() {
      return finished;
    },

    setPresent(next) {
      if (disposed) return Promise.resolve('cancelled');
      if (next) {
        if (present && state === 'open' && !exiting) return finished;
        present = true;
        exiting = false;
        mounted = true;
        state = 'open';
        writeAttr();
        const result = begin();
        emit();
        options.onEnter?.(snapshot());
        if (reverseTo('enter')) return result;
        dropAnimation();
        if (node) play('enter');
        else pendingEnter = true;
        return result;
      }

      present = false;
      if (!mounted || (state === 'closed' && !exiting)) {
        state = 'closed';
        writeAttr();
        return finished;
      }
      if (exiting) return finished;
      pendingEnter = false;
      exiting = true;
      state = 'closed';
      writeAttr();
      const result = begin();
      emit();
      if (reverseTo('exit')) return result;
      dropAnimation();
      if (node) play('exit');
      else complete('exit', 'instant');
      return result;
    },

    setNode(next) {
      if (disposed || next === node) return;
      if (animation) {
        // The animated element changed: its animation cannot continue elsewhere.
        const dir = direction ?? 'enter';
        dropAnimation();
        node = next;
        writeAttr();
        if (next) play(dir);
        else complete(dir, 'instant');
        return;
      }
      node = next;
      writeAttr();
      if (!next) {
        if (exiting) complete('exit', 'instant');
        return;
      }
      if (pendingEnter && present) {
        pendingEnter = false;
        if (!settle) begin();
        play('enter');
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      dropAnimation();
      settle?.('cancelled');
      node = null;
    },
  };
}
