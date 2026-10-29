/**
 * Sequences and timelines (ADR-013): declared steps played as Web Animations
 * on one shared clock.
 *
 * Top-level entries run one after another; a `parallel(...)` group runs its
 * steps together (the group lasts as long as its longest step). Each step may
 * add an `at` offset inside its slot, which is how `stagger` spreads a list.
 * Every animation gets the same total length (`delay` + `duration` +
 * `endDelay`), so `seek`, `pause` and `reverse` keep the steps aligned.
 *
 * Under reduced motion, at level `none`, without the Web Animations API or on
 * the server, the timeline commits at once: `finished` resolves `"instant"`
 * and `onFinish` fires once; play, pause, seek and reverse do nothing.
 */

import {
  createRun,
  type InstantReason,
  type MotionKeyframes,
  type MotionOutcome,
  type MotionTiming,
  resolveMotion,
  startAnimation,
} from './animate.ts';
import { MAX_MOTION_MS, motionDuration } from './preferences.ts';

/** One animated step. */
export type TimelineStep = {
  readonly target: Element | null | undefined;
  readonly keyframes: MotionKeyframes;
  /** Milliseconds (clamped to [0, 1000]). Default: the timeline's `duration`. */
  readonly duration?: number;
  readonly easing?: string;
  /** Extra offset inside the step's slot, in ms (clamped to [0, 1000]). */
  readonly at?: number;
};

/** A group whose steps run together. */
export type ParallelGroup = { readonly parallel: readonly TimelineStep[] };

export type TimelineEntry = TimelineStep | ParallelGroup;

export type TimelineOptions = MotionTiming & {
  /** Start playing at once. `timeline` defaults to `false`, `sequence` to `true`. */
  autoplay?: boolean;
  onFinish?: (outcome: MotionOutcome) => void;
};

export type Timeline = {
  /** Total length in ms after the level is applied (0 when instant). */
  readonly duration: number;
  readonly finished: Promise<MotionOutcome>;
  readonly instantReason: InstantReason | null;
  readonly animations: readonly Animation[];
  play: () => void;
  pause: () => void;
  /** Move every step to `ms` on the shared clock (clamped to [0, duration]). */
  seek: (ms: number) => void;
  /** Play backwards from the current time. */
  reverse: () => void;
  cancel: () => void;
  finish: () => void;
};

/** Most steps one timeline animates; past it the timeline commits at once. */
export const MAX_TIMELINE_STEPS = 500;
/** Longest stagger spread, in ms: a long list compresses its per-item offset to fit. */
export const MAX_STAGGER_SPAN = MAX_MOTION_MS;

/** Group steps to run in parallel. */
export function parallel(...steps: TimelineStep[]): ParallelGroup {
  return { parallel: steps };
}

export type StaggerOptions = {
  /** Which item starts first. Default `"start"`. */
  from?: 'start' | 'end' | 'center' | number;
};

/**
 * Offsets in ms for `count` items `each` ms apart, spread from `from`. The
 * whole spread is held to {@link MAX_STAGGER_SPAN} (a long list staggers
 * faster instead of taking longer). `count` is clamped to [0, 10000].
 */
export function stagger(count: number, each: number, options: StaggerOptions = {}): number[] {
  const n = Math.max(0, Math.min(10_000, Math.floor(Number.isFinite(count) ? count : 0)));
  if (n === 0) return [];
  const origin =
    options.from === 'end'
      ? n - 1
      : options.from === 'center'
        ? (n - 1) / 2
        : typeof options.from === 'number' && Number.isFinite(options.from)
          ? Math.max(0, Math.min(n - 1, Math.floor(options.from)))
          : 0;
  const reach = Math.max(origin, n - 1 - origin);
  const step = Number.isFinite(each) && each > 0 ? each : 0;
  const per = reach > 0 ? Math.min(step, MAX_STAGGER_SPAN / reach) : 0;
  return Array.from({ length: n }, (_, i) => Math.round(Math.abs(i - origin) * per * 100) / 100);
}

type Plan = ReturnType<typeof resolveMotion>;
type Scheduled = { step: TimelineStep; start: number; plan: Plan };

function planOf(step: TimelineStep, options: TimelineOptions): Plan {
  return resolveMotion(step?.target, step?.keyframes ?? [], {
    ...options,
    duration: step?.duration ?? options.duration ?? 200,
    easing: step?.easing ?? options.easing,
    delay: 0,
  });
}

/** Resolve every step, then lay the slots out with the resolved durations. */
function schedule(entries: readonly TimelineEntry[], options: TimelineOptions): Scheduled[] | null {
  const level = options.level ?? 'full';
  const out: Scheduled[] = [];
  let cursor = 0;
  const slot = (step: TimelineStep, base: number): number => {
    const plan = planOf(step, options);
    const at = motionDuration(step?.at ?? 0, level);
    out.push({ step, start: base + at, plan });
    return at + (plan.instant ? 0 : plan.duration);
  };
  for (const entry of entries) {
    if (!entry) continue;
    if ('parallel' in entry) {
      let longest = 0;
      for (const step of entry.parallel ?? []) {
        if (out.length >= MAX_TIMELINE_STEPS) return null;
        longest = Math.max(longest, slot(step, cursor));
      }
      cursor += longest;
    } else {
      if (out.length >= MAX_TIMELINE_STEPS) return null;
      cursor += slot(entry, cursor);
    }
  }
  return out;
}

function build(
  entries: readonly TimelineEntry[],
  options: TimelineOptions,
  autoplay: boolean
): Timeline {
  const instant = (reason: InstantReason): Timeline => {
    const run = createRun([], options.onFinish, reason);
    return {
      duration: 0,
      finished: run.finished,
      instantReason: run.instantReason,
      animations: [],
      play() {},
      pause() {},
      seek() {},
      reverse() {},
      cancel() {},
      finish() {},
    };
  };
  const scheduled = schedule(Array.isArray(entries) ? entries : [], options);
  if (!scheduled) return instant('limit');
  const live = scheduled.filter((p) => !p.plan.instant);
  if (live.length === 0) {
    const first = scheduled.find((p) => p.plan.instant)?.plan;
    return instant(first?.instant ? first.reason : 'zero-duration');
  }
  const total = Math.max(...live.map((p) => p.start + (p.plan.instant ? 0 : p.plan.duration)));

  const animations: Animation[] = [];
  for (const { step, start, plan } of live) {
    if (plan.instant || !step.target) continue;
    const animation = startAnimation(
      step.target,
      { ...plan, delay: start },
      { endDelay: Math.max(0, total - start - plan.duration) }
    );
    if (!animation) continue;
    if (!autoplay) animation.pause();
    animations.push(animation);
  }
  if (animations.length === 0) return instant('error');
  const run = createRun(animations, options.onFinish);
  const each = (fn: (a: Animation) => void) => () => {
    for (const a of animations) {
      try {
        fn(a);
      } catch {
        // A finished or cancelled animation ignores the command.
      }
    }
  };

  return {
    duration: total,
    finished: run.finished,
    instantReason: null,
    animations,
    play: each((a) => a.play()),
    pause: each((a) => a.pause()),
    reverse: each((a) => a.reverse()),
    seek(ms) {
      const t = Number.isFinite(ms) ? Math.max(0, Math.min(total, ms)) : 0;
      each((a) => {
        a.currentTime = t;
      })();
    },
    cancel: run.cancel,
    finish: run.finish,
  };
}

/** Build a timeline, paused until `play()` unless `autoplay` is true. */
export function timeline(
  entries: readonly TimelineEntry[],
  options: TimelineOptions = {}
): Timeline {
  return build(entries, options, options.autoplay === true);
}

/** Play steps now (a timeline that autoplays unless `autoplay: false`). */
export function sequence(
  entries: readonly TimelineEntry[],
  options: TimelineOptions = {}
): Timeline {
  return build(entries, options, options.autoplay !== false);
}
