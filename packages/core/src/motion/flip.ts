/**
 * FLIP layout animation (ADR-013): measure (First), let the DOM change
 * (Last), Invert with a transform, Play it back to identity.
 *
 * Reads and writes are batched: `measure` and `play` read every rectangle
 * before they cancel or start any animation, so a list of any length lays out
 * once per phase. A `measure` during a running play reads the in-flight
 * (visual) positions, then interrupts the old run, so a re-reorder continues
 * from where items are on screen.
 *
 * Deltas are measured in physical pixels, so reorders are correct in either
 * direction; insert offsets are logical (`inline-start` follows `dir`).
 * At level `subtle` moved items snap (no travel) and inserts only fade;
 * at `none` or under reduced motion everything commits at once.
 */

import { getOwnerWindow } from '../env/index.ts';
import {
  createRun,
  type MotionKeyframes,
  type MotionOutcome,
  type MotionRun,
  type MotionTiming,
  resolveMotion,
  startAnimation,
} from './animate.ts';

/** Items keyed by a stable id (a `Map` works). */
export type FlipItems = Iterable<readonly [string, Element]>;

/** Where an inserted item comes from: a fade, or a short slide from a logical side. */
export type FlipEnter =
  | false
  | 'fade'
  | 'inline-start'
  | 'inline-end'
  | 'block-start'
  | 'block-end'
  | MotionKeyframes;

export type FlipOptions = MotionTiming & {
  /** Animate size changes with a scale as well. Default `true`. */
  scale?: boolean;
  /** Inserted items (keys `measure` did not see). Default `"fade"`. */
  enter?: FlipEnter;
  /** Slide distance for a logical `enter`, in px (clamped to [0, 64]). Default 8. */
  enterDistance?: number;
  /** Above this many animated items the change commits at once. Default 500. */
  maxItems?: number;
  onFinish?: (outcome: MotionOutcome) => void;
};

export type FlipController = {
  /** First: record where every item is now (interrupts a running play). */
  measure: (items: FlipItems) => void;
  /** Last, Invert, Play: animate each item from its measured box to its current one. */
  play: (items: FlipItems) => MotionRun;
  /** Cancel the running play. */
  cancel: () => void;
};

type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

const MAX_DELTA = 100_000;

function boxOf(element: Element): Box | null {
  if (!element.isConnected || typeof element.getBoundingClientRect !== 'function') return null;
  const r = element.getBoundingClientRect();
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  return Number.isFinite(box.left) &&
    Number.isFinite(box.top) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height)
    ? box
    : null;
}

function num(value: number): string {
  const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, value));
  const r = Math.round(clamped * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

/** The inverted transform from `first` to `last` (`null` when nothing moved). */
export function flipTransform(first: Box, last: Box, scale = true): string | null {
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = scale && last.width > 0 && first.width > 0 ? first.width / last.width : 1;
  const sy = scale && last.height > 0 && first.height > 0 ? first.height / last.height : 1;
  if (
    Math.abs(dx) < 0.5 &&
    Math.abs(dy) < 0.5 &&
    Math.abs(sx - 1) < 0.001 &&
    Math.abs(sy - 1) < 0.001
  ) {
    return null;
  }
  const move = `translate(${num(dx)}px, ${num(dy)}px)`;
  return sx === 1 && sy === 1 ? move : `${move} scale(${num(sx)}, ${num(sy)})`;
}

function isRtl(element: Element): boolean {
  const win = getOwnerWindow(element);
  try {
    return win?.getComputedStyle(element).direction === 'rtl';
  } catch {
    return false;
  }
}

function enterFrames(enter: FlipEnter, distance: number, rtl: boolean): MotionKeyframes | null {
  if (enter === false) return null;
  if (typeof enter === 'object') return enter;
  if (enter === 'fade') return [{ opacity: 0 }, { opacity: 1 }];
  const sign = enter === 'inline-start' || enter === 'block-start' ? -1 : 1;
  const inline = enter.startsWith('inline');
  const px = num(sign * distance * (inline && rtl ? -1 : 1));
  const from = inline ? `translate(${px}px, 0px)` : `translate(0px, ${px}px)`;
  return [
    { opacity: 0, transform: from },
    { opacity: 1, transform: 'none' },
  ];
}

/**
 * Create a FLIP controller for one list (or any set of keyed elements).
 *
 * @example
 * const flip = createFlip({ duration: 200 });
 * flip.measure(itemsByKey);
 * reorder(); // the DOM changes
 * await flip.play(itemsByKey).finished;
 */
export function createFlip(options: FlipOptions = {}): FlipController {
  const scale = options.scale !== false;
  const enter = options.enter ?? 'fade';
  const distance = Math.max(
    0,
    Math.min(64, Number.isFinite(options.enterDistance) ? (options.enterDistance as number) : 8)
  );
  const maxItems = Math.max(
    0,
    Math.floor(Number.isFinite(options.maxItems) ? (options.maxItems as number) : 500)
  );
  let first = new Map<string, Box>();
  let running: (MotionRun & { interrupt: () => void }) | null = null;

  function interrupt(): void {
    running?.interrupt();
    running = null;
  }

  return {
    measure(items) {
      // Read phase: every box (in-flight transforms included) before any write.
      const next = new Map<string, Box>();
      for (const [key, element] of items) {
        const box = element ? boxOf(element) : null;
        if (box) next.set(String(key), box);
      }
      first = next;
      // Write phase: stop the old run so `play` reads the new layout untransformed.
      interrupt();
    },

    play(items) {
      interrupt();
      const before = first;
      first = new Map();

      // Read phase.
      type Job = {
        element: Element;
        frames: MotionKeyframes;
        plan: ReturnType<typeof resolveMotion>;
      };
      const jobs: Job[] = [];
      let rtl: boolean | null = null;
      for (const [rawKey, element] of items) {
        if (!element) continue;
        const key = String(rawKey);
        const last = boxOf(element);
        if (!last) continue;
        const from = before.get(key);
        let frames: MotionKeyframes | null;
        if (from) {
          const transform = flipTransform(from, last, scale);
          frames = transform
            ? [
                { transform, transformOrigin: '0 0' },
                { transform: 'none', transformOrigin: '0 0' },
              ]
            : null;
        } else {
          if (rtl === null && typeof enter === 'string' && enter.startsWith('inline'))
            rtl = isRtl(element);
          frames = enterFrames(enter, distance, rtl === true);
        }
        if (frames) jobs.push({ element, frames, plan: resolveMotion(element, frames, options) });
      }

      if (jobs.length > maxItems) {
        return createRun([], options.onFinish, 'limit');
      }

      // Write phase.
      const animations: Animation[] = [];
      let reason: ReturnType<typeof createRun>['instantReason'] = null;
      for (const job of jobs) {
        if (job.plan.instant) {
          reason ??= job.plan.reason;
          continue;
        }
        const animation = startAnimation(job.element, job.plan);
        if (animation) animations.push(animation);
        else reason ??= 'error';
      }
      const run = createRun(animations, options.onFinish, reason ?? 'zero-duration');
      running = animations.length > 0 ? run : null;
      return run;
    },

    cancel() {
      running?.cancel();
      running = null;
    },
  };
}
