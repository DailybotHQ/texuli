/**
 * Motion tokens (ADR-013): five durations, five easings and three springs,
 * as data and as `--tx-motion-*` custom properties.
 *
 * The spring curves are precomputed CSS `linear()` easings from the
 * `@texuli/core/motion` solver (32 samples); a test recomputes them so the
 * strings cannot drift. This module has no runtime dependency.
 */

import {
  MOTION_DURATION_STEPS,
  MOTION_DURATIONS,
  type MotionDurationStep,
  slowerDuration,
} from './durations.ts';

export {
  MOTION_DURATION_STEPS,
  MOTION_DURATIONS,
  type MotionDurationStep,
  slowerDuration,
} from './durations.ts';

export const MOTION_EASING_NAMES = ['standard', 'emphasized', 'enter', 'exit', 'linear'] as const;
export type MotionEasingName = (typeof MOTION_EASING_NAMES)[number];

/** Easing curves: `standard` for most changes, `enter` decelerates in, `exit` accelerates out. */
export const MOTION_EASINGS: Readonly<Record<MotionEasingName, string>> = Object.freeze({
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  linear: 'linear',
});

export const MOTION_SPRING_NAMES = ['gentle', 'snappy', 'bouncy'] as const;
export type MotionSpringName = (typeof MOTION_SPRING_NAMES)[number];

/** A spring token: the physical parameters plus its precomputed curve. */
export type MotionSpringToken = {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  /** Settle time in ms (the animation duration). */
  readonly durationMs: number;
  /** CSS `linear()` easing tracing the spring over `durationMs`. */
  readonly easing: string;
};

/** Samples in each precomputed spring curve. */
export const MOTION_SPRING_SAMPLES = 32;

/**
 * Springs: `gentle` (ζ 0.91, no visible overshoot), `snappy` (ζ 0.75, a small
 * overshoot) and `bouncy` (ζ 0.46, playful). All settle under 1,000 ms.
 */
export const MOTION_SPRINGS: Readonly<Record<MotionSpringName, MotionSpringToken>> = Object.freeze({
  gentle: Object.freeze({
    stiffness: 120,
    damping: 20,
    mass: 1,
    durationMs: 648,
    easing:
      'linear(0, 0.0228, 0.0795, 0.1561, 0.2426, 0.3318, 0.419, 0.5013, 0.5767, 0.6444, 0.7041, 0.7561, 0.8007, 0.8386, 0.8704, 0.8969, 0.9187, 0.9365, 0.951, 0.9626, 0.9718, 0.9791, 0.9848, 0.9892, 0.9925, 0.9951, 0.9969, 0.9983, 0.9993, 0.9999, 1.0004, 1)',
  }),
  snappy: Object.freeze({
    stiffness: 400,
    damping: 30,
    mass: 1,
    durationMs: 453,
    easing:
      'linear(0, 0.0368, 0.1267, 0.2447, 0.3726, 0.4983, 0.6137, 0.7148, 0.7995, 0.8679, 0.9212, 0.9609, 0.9892, 1.0082, 1.0199, 1.0261, 1.0283, 1.0278, 1.0255, 1.0223, 1.0187, 1.0151, 1.0117, 1.0088, 1.0062, 1.0042, 1.0026, 1.0014, 1.0005, 0.9999, 0.9995, 1)',
  }),
  bouncy: Object.freeze({
    stiffness: 380,
    damping: 18,
    mass: 1,
    durationMs: 844,
    easing:
      'linear(0, 0.1177, 0.3817, 0.6779, 0.9294, 1.0989, 1.1811, 1.1921, 1.1571, 1.1015, 1.0453, 1.001, 0.9737, 0.9627, 0.964, 0.9727, 0.9839, 0.9943, 1.0019, 1.0061, 1.0074, 1.0066, 1.0046, 1.0024, 1.0006, 0.9993, 0.9987, 0.9986, 0.9988, 0.9992, 0.9997, 1)',
  }),
});

/** `--tx-motion-<step>`; `fast`, `base` and `slow` are the existing theme variables. */
export function motionDurationVar(step: MotionDurationStep): `--tx-motion-${MotionDurationStep}` {
  return `--tx-motion-${step}`;
}

/** `--tx-motion-ease-<name>`. */
export function motionEasingVar(name: MotionEasingName): `--tx-motion-ease-${MotionEasingName}` {
  return `--tx-motion-ease-${name}`;
}

/** `--tx-motion-spring-<name>` (the easing) and `--tx-motion-spring-<name>-duration`. */
export function motionSpringVars(name: MotionSpringName): {
  easing: `--tx-motion-spring-${MotionSpringName}`;
  duration: `--tx-motion-spring-${MotionSpringName}-duration`;
} {
  return { easing: `--tx-motion-spring-${name}`, duration: `--tx-motion-spring-${name}-duration` };
}

export type MotionVariablesInput = {
  /** Theme durations (the theme contract's `style.motion.durations`). Default the token values. */
  durations?: Partial<Record<'fast' | 'base' | 'slow', number>>;
  /** Zero every duration and make every easing `linear`. */
  reducedMotion?: boolean;
};

/**
 * Every motion custom property: the five duration steps, the five easings and
 * each spring's easing and duration. Under reduced motion, durations are
 * `0ms` and easings `linear`, matching the base stylesheet's reduced rules.
 */
export function motionVariables(input: MotionVariablesInput = {}): Record<string, string> {
  const reduced = input.reducedMotion === true;
  const pick = (key: 'fast' | 'base' | 'slow'): number => {
    const value = input.durations?.[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.round(value)
      : MOTION_DURATIONS[key];
  };
  const durations: Record<MotionDurationStep, number> = {
    instant: 0,
    fast: pick('fast'),
    base: pick('base'),
    slow: pick('slow'),
    slower: slowerDuration(pick('slow')),
  };
  const vars: Record<string, string> = {};
  for (const step of MOTION_DURATION_STEPS) {
    vars[motionDurationVar(step)] = reduced ? '0ms' : `${durations[step]}ms`;
  }
  for (const name of MOTION_EASING_NAMES) {
    vars[motionEasingVar(name)] = reduced ? 'linear' : MOTION_EASINGS[name];
  }
  for (const name of MOTION_SPRING_NAMES) {
    const names = motionSpringVars(name);
    const spring = MOTION_SPRINGS[name];
    vars[names.easing] = reduced ? 'linear' : spring.easing;
    vars[names.duration] = reduced ? '0ms' : `${spring.durationMs}ms`;
  }
  return vars;
}

/** Every motion custom property name, in a stable order. */
export const MOTION_VARIABLE_NAMES: readonly string[] = Object.freeze(
  Object.keys(motionVariables())
);
