/**
 * Animate: the Web Animations wrapper every motion texel plays through
 * (ADR-013). It clamps timing, applies the motion level and reduced motion,
 * and commits the end state at once (no frames, `finished` resolves
 * `"instant"`) whenever motion cannot or must not run: on the server, without
 * the Web Animations API, on a detached element, at level `none`, under
 * reduced motion, or with a zero duration.
 *
 * Animations use `fill: "none"` (`"backwards"` only while a delay holds the
 * first frame), so no inline style outlives them; the final state belongs in
 * classes, attributes or props.
 */

import { getOwnerWindow } from '../env/index.ts';
import { prefersReducedMotion } from '../presence/presence.ts';
import {
  type MotionLevel,
  motionDuration,
  REDUCED_FADE_MS,
  type ReducedMotionPolicy,
  type ReducedMotionSource,
} from './preferences.ts';
import { type SpringParams, springEasing } from './spring.ts';

/** Keyframes in either Web Animations form. */
export type MotionKeyframes = Keyframe[] | PropertyIndexedKeyframes;

/** How a motion run ended. */
export type MotionOutcome =
  /** Every animation played to its end. */
  | 'finished'
  /** The end state was committed without frames (see {@link InstantReason}). */
  | 'instant'
  /** `cancel()` stopped it. */
  | 'cancelled'
  /** A newer run took over (a reversal, a new measure, a new transition). */
  | 'interrupted';

/** Why a run committed instantly. */
export type InstantReason =
  | 'server'
  | 'detached'
  | 'level-none'
  | 'reduced-motion'
  | 'no-properties'
  | 'zero-duration'
  | 'no-waapi'
  | 'error'
  | 'limit';

/** Reduced motion: a fixed value, a live source, or omitted (read the element's window). */
export type ReducedMotionInput = boolean | ReducedMotionSource | null | undefined;

/** Timing and policy shared by every motion texel. */
export type MotionTiming = {
  /** Milliseconds, clamped to [0, 1000]; NaN or negative is 0 (instant). Default 200. */
  duration?: number;
  /** Milliseconds before the animation starts, clamped like `duration`. Default 0. */
  delay?: number;
  /** A CSS easing. Default `cubic-bezier(0.4, 0, 0.2, 1)` (the `standard` token). */
  easing?: string;
  /** Play on a spring instead: the duration is its settle time and the easing its `linear()` curve. */
  spring?: Partial<SpringParams> & { velocity?: number };
  /** The already-resolved motion level (see `resolveMotionLevel`). Default `full`. */
  level?: MotionLevel;
  /** Reduced motion; omitted reads `prefers-reduced-motion` from the element's window. */
  reducedMotion?: ReducedMotionInput;
  /** `instant` (default) commits the end state; `fade` keeps an opacity-only 150 ms fade. */
  reducedMotionPolicy?: ReducedMotionPolicy;
};

/** One running (or already settled) motion. */
export type MotionRun = {
  /** Resolves once with the outcome; never rejects. */
  readonly finished: Promise<MotionOutcome>;
  /** The live animations (empty when instant). */
  readonly animations: readonly Animation[];
  /** Why it committed instantly, or `null` when it animates. */
  readonly instantReason: InstantReason | null;
  /** Stop now; no style remains. Resolves `finished` with `"cancelled"`. */
  cancel: () => void;
  /** Jump to the end. Resolves `finished` with `"finished"`. */
  finish: () => void;
};

export type AnimateOptions = MotionTiming & {
  /** Called once with the outcome, before `finished` resolves. */
  onFinish?: (outcome: MotionOutcome) => void;
};

/** Default duration (the `base` token) and easing (the `standard` token). */
export const DEFAULT_MOTION_DURATION = 200;
export const DEFAULT_MOTION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const SPRING_FALLBACK_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/** Properties that move or scale: dropped at level `subtle`. */
const TRAVEL = new Set([
  'transform',
  'transformOrigin',
  'translate',
  'scale',
  'rotate',
  'offsetDistance',
]);
const META = new Set(['offset', 'easing', 'composite']);

/** Resolved, clamped plan for one animation. */
export type ResolvedMotion =
  | { readonly instant: true; readonly reason: InstantReason }
  | {
      readonly instant: false;
      readonly keyframes: MotionKeyframes;
      readonly duration: number;
      readonly delay: number;
      readonly easing: string;
    };

function filterKeyframes(
  keyframes: MotionKeyframes,
  keep: (property: string) => boolean
): MotionKeyframes | null {
  let any = false;
  if (Array.isArray(keyframes)) {
    const out = keyframes.map((frame) => {
      const next: Keyframe = {};
      for (const [key, value] of Object.entries(frame ?? {})) {
        if (META.has(key) || keep(key)) {
          (next as Record<string, unknown>)[key] = value;
          if (!META.has(key)) any = true;
        }
      }
      return next;
    });
    return any ? out : null;
  }
  if (!keyframes || typeof keyframes !== 'object') return null;
  const out: PropertyIndexedKeyframes = {};
  for (const [key, value] of Object.entries(keyframes)) {
    if (META.has(key) || keep(key)) {
      (out as Record<string, unknown>)[key] = value;
      if (!META.has(key)) any = true;
    }
  }
  return any ? out : null;
}

/** Keyframes without movement or scale (what `subtle` plays). `null` when nothing is left. */
export function withoutTravel(keyframes: MotionKeyframes): MotionKeyframes | null {
  return filterKeyframes(keyframes, (property) => !TRAVEL.has(property));
}

function opacityOnly(keyframes: MotionKeyframes): MotionKeyframes | null {
  return filterKeyframes(keyframes, (property) => property === 'opacity');
}

function readReduced(input: ReducedMotionInput, win: Window | undefined): boolean {
  if (typeof input === 'boolean') return input;
  if (input && typeof input.get === 'function') return input.get() === true;
  return prefersReducedMotion(win ?? null, false);
}

function supportsLinear(win: Window | undefined): boolean {
  try {
    const css = (
      win as { CSS?: { supports?: (property: string, value: string) => boolean } } | undefined
    )?.CSS;
    return css?.supports?.('animation-timing-function', 'linear(0, 1)') === true;
  } catch {
    return false;
  }
}

/**
 * Resolve keyframes and timing for one element: the level, reduced motion,
 * clamping and the environment checks, without starting anything.
 */
export function resolveMotion(
  element: Element | null | undefined,
  keyframes: MotionKeyframes,
  timing: MotionTiming = {}
): ResolvedMotion {
  const win = element ? getOwnerWindow(element) : undefined;
  if (!element || !win) return { instant: true, reason: 'server' };
  if (!element.isConnected) return { instant: true, reason: 'detached' };
  const level = timing.level ?? 'full';
  if (level === 'none') return { instant: true, reason: 'level-none' };

  let frames: MotionKeyframes | null = keyframes;
  let duration: number;
  let delay: number;
  let easing =
    typeof timing.easing === 'string' && timing.easing ? timing.easing : DEFAULT_MOTION_EASING;

  if (readReduced(timing.reducedMotion, win)) {
    if (timing.reducedMotionPolicy !== 'fade') return { instant: true, reason: 'reduced-motion' };
    frames = opacityOnly(keyframes);
    duration = REDUCED_FADE_MS;
    delay = 0;
    easing = 'linear';
  } else {
    if (level === 'subtle') frames = withoutTravel(keyframes);
    if (timing.spring) {
      const spring = springEasing(timing.spring, { velocity: timing.spring.velocity ?? 0 });
      duration = motionDuration(spring.durationMs, level);
      easing = supportsLinear(win) ? spring.easing : SPRING_FALLBACK_EASING;
    } else {
      duration = motionDuration(timing.duration ?? DEFAULT_MOTION_DURATION, level);
    }
    delay = motionDuration(timing.delay ?? 0, level);
  }

  if (!frames) return { instant: true, reason: 'no-properties' };
  if (duration <= 0) return { instant: true, reason: 'zero-duration' };
  if (typeof (element as Partial<Element>).animate !== 'function') {
    return { instant: true, reason: 'no-waapi' };
  }
  return { instant: false, keyframes: frames, duration, delay, easing };
}

/** Start a resolved plan; `null` when the browser refuses it (an invalid easing, say). */
export function startAnimation(
  element: Element,
  plan: Extract<ResolvedMotion, { instant: false }>,
  extra: { endDelay?: number } = {}
): Animation | null {
  try {
    const animation = element.animate(plan.keyframes, {
      duration: plan.duration,
      delay: plan.delay,
      endDelay: extra.endDelay ?? 0,
      easing: plan.easing,
      fill: plan.delay > 0 ? 'backwards' : 'none',
    });
    // A cancelled animation rejects `finished`; never leave that unhandled.
    animation?.finished?.catch(() => {});
    return animation ?? null;
  } catch {
    return null;
  }
}

/**
 * Settle a set of animations as one run. With no animations the run is
 * instant: `onFinish` fires synchronously and `finished` resolves `"instant"`.
 */
export function createRun(
  animations: readonly Animation[],
  onFinish?: (outcome: MotionOutcome) => void,
  instantReason: InstantReason | null = null
): MotionRun & { interrupt: () => void } {
  let settled = false;
  let resolve: (outcome: MotionOutcome) => void = () => {};
  const finished = new Promise<MotionOutcome>((r) => {
    resolve = r;
  });
  const settle = (outcome: MotionOutcome): void => {
    if (settled) return;
    settled = true;
    onFinish?.(outcome);
    resolve(outcome);
  };
  const stopAll = (outcome: MotionOutcome): void => {
    settle(outcome);
    for (const animation of animations) {
      try {
        animation.cancel();
      } catch {
        // A cancelled animation stays cancelled.
      }
    }
  };

  if (animations.length === 0) {
    settle('instant');
  } else {
    let remaining = animations.length;
    for (const animation of animations) {
      animation.finished.then(
        () => {
          remaining -= 1;
          if (remaining === 0) settle('finished');
        },
        () => settle('cancelled')
      );
    }
  }

  return {
    finished,
    animations,
    instantReason: animations.length === 0 ? (instantReason ?? 'zero-duration') : null,
    cancel: () => stopAll('cancelled'),
    interrupt: () => stopAll('interrupted'),
    finish() {
      if (settled) return;
      for (const animation of animations) {
        try {
          animation.finish();
        } catch {
          // An animation that cannot finish is cancelled below.
          animation.cancel();
        }
      }
      settle('finished');
    },
  };
}

/**
 * Animate one element through the Web Animations API with the motion level
 * and reduced motion applied.
 *
 * @example
 * const run = animate(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
 * await run.finished; // "finished", or "instant" under reduced motion
 */
export function animate(
  element: Element | null | undefined,
  keyframes: MotionKeyframes,
  options: AnimateOptions = {}
): MotionRun {
  const plan = resolveMotion(element, keyframes, options);
  if (plan.instant || !element) {
    return createRun([], options.onFinish, plan.instant ? plan.reason : 'server');
  }
  const animation = startAnimation(element, plan);
  return createRun(animation ? [animation] : [], options.onFinish, animation ? null : 'error');
}
