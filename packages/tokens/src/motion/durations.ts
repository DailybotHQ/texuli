/**
 * Motion duration steps (ADR-013). Kept apart from the easing and spring data
 * so the theme CSS entry can derive `slower` without bundling the curves.
 */

/** Duration steps, shortest first. */
export const MOTION_DURATION_STEPS = ['instant', 'fast', 'base', 'slow', 'slower'] as const;
export type MotionDurationStep = (typeof MOTION_DURATION_STEPS)[number];

/**
 * Default durations in ms. `fast`, `base` and `slow` are the theme contract's
 * values (a theme may change them); `instant` is always 0 and `slower` follows
 * the theme's `slow` (see {@link slowerDuration}).
 */
export const MOTION_DURATIONS: Readonly<Record<MotionDurationStep, number>> = Object.freeze({
  instant: 0,
  fast: 150,
  base: 200,
  slow: 300,
  slower: 500,
});

/**
 * The `slower` step for a theme's `slow` duration: 5/3 of it (300 → 500),
 * at most 1,000 ms, and never shorter than `slow`.
 */
export function slowerDuration(slow: number): number {
  if (!Number.isFinite(slow) || slow <= 0) return 0;
  return Math.max(Math.round(slow), Math.min(1000, Math.round((slow * 5) / 3)));
}
