/**
 * The motion prop contract of the styled components (ADR-013). Static and
 * tiny: no runtime import. Components name presets from the closed spec 0.6.0
 * vocabulary (`@texuli/spec/motion`, `SPEC_MOTION_PRESETS`) and token duration
 * steps; nothing here is CSS, keyframes or milliseconds.
 */

import type { MotionLevel } from '@texuli/core/motion';

export type { MotionLevel };

/** Enter and exit presets: the spec's closed names (`$defs.motionPreset`). */
export const MOTION_PRESETS = Object.freeze([
  'fade',
  'rise',
  'scale',
  'slide-start',
  'slide-end',
] as const);
export type MotionPreset = (typeof MOTION_PRESETS)[number];

/** Duration token steps (`$defs.motionDuration`): `--tx-motion-fast`, `-base`, `-slow`. */
export const MOTION_DURATION_NAMES = Object.freeze(['fast', 'base', 'slow'] as const);
export type MotionDurationName = (typeof MOTION_DURATION_NAMES)[number];

/** The shared levels, highest first (the deck's `full`, `subtle`, `none`). */
export const MOTION_LEVEL_NAMES: readonly MotionLevel[] = Object.freeze(['full', 'subtle', 'none']);

/**
 * What one component animates. Omitted fields keep the component's default;
 * `false` turns that part off.
 */
export interface ComponentMotion {
  /** How the component (an overlay, a toast, an inserted item) appears. */
  enter?: MotionPreset | false;
  /** How it leaves; it stays mounted, inert, until the exit ends. */
  exit?: MotionPreset | false;
  /** Layout animation: reorders, inserts and removes (FLIP), the tabs indicator, accordion height. */
  layout?: boolean;
  /** The duration token step. Default per component (`fast` for small floating parts). */
  duration?: MotionDurationName;
}

/** The `motion` prop: a {@link ComponentMotion}, or `false` for none at all. */
export type MotionProp = ComponentMotion | false;

/** A component's motion with its defaults applied. */
export interface ResolvedComponentMotion {
  readonly enter: MotionPreset | false;
  readonly exit: MotionPreset | false;
  readonly layout: boolean;
  readonly duration: MotionDurationName;
}

const RANK: Readonly<Record<MotionLevel, number>> = { none: 0, subtle: 1, full: 2 };

export function isMotionPreset(value: unknown): value is MotionPreset {
  return typeof value === 'string' && (MOTION_PRESETS as readonly string[]).includes(value);
}

export function isMotionLevelName(value: unknown): value is MotionLevel {
  return typeof value === 'string' && (MOTION_LEVEL_NAMES as readonly string[]).includes(value);
}

/** The lower of two levels (`none` < `subtle` < `full`). */
export function lowerLevel(a: MotionLevel, b: MotionLevel): MotionLevel {
  return RANK[a] <= RANK[b] ? a : b;
}

const OFF: ResolvedComponentMotion = Object.freeze({
  enter: false,
  exit: false,
  layout: false,
  duration: 'base',
});

/**
 * Apply a component's defaults to its `motion` prop. Unknown preset or
 * duration names fall back to the default (a typed prop cannot carry them,
 * but a host may pass data through).
 */
export function resolveComponentMotion(
  prop: MotionProp | null | undefined,
  defaults: ComponentMotion
): ResolvedComponentMotion {
  if (prop === false) return OFF;
  const own = prop && typeof prop === 'object' ? prop : {};
  const pick = (
    value: unknown,
    fallback: MotionPreset | false | undefined
  ): MotionPreset | false =>
    value === false ? false : isMotionPreset(value) ? value : (fallback ?? false);
  const duration = (MOTION_DURATION_NAMES as readonly string[]).includes(own.duration as string)
    ? (own.duration as MotionDurationName)
    : (defaults.duration ?? 'base');
  return {
    enter: pick(own.enter, defaults.enter),
    exit: pick(own.exit, defaults.exit),
    layout: typeof own.layout === 'boolean' ? own.layout : defaults.layout === true,
    duration,
  };
}
