/**
 * @texuli/core/motion: the motion runtime (ADR-013). Web Animations with an
 * owned spring solver, reduced motion instant by construction, and the
 * `full` / `subtle` / `none` motion levels shared with the deck.
 *
 * Not re-exported from the `@texuli/core` root barrel: a component that does
 * not animate pays nothing for it.
 */

export {
  type AnimateOptions,
  animate,
  createRun,
  DEFAULT_MOTION_DURATION,
  DEFAULT_MOTION_EASING,
  type InstantReason,
  type MotionKeyframes,
  type MotionOutcome,
  type MotionRun,
  type MotionTiming,
  type ReducedMotionInput,
  type ResolvedMotion,
  resolveMotion,
  startAnimation,
  withoutTravel,
} from './animate.ts';
export {
  createFlip,
  type FlipController,
  type FlipEnter,
  type FlipItems,
  type FlipOptions,
  flipTransform,
} from './flip.ts';
export {
  createReducedMotionSource,
  isMotionLevel,
  lowerMotionLevel,
  MAX_MOTION_MS,
  MOTION_LEVELS,
  type MotionLevel,
  type MotionLevelInput,
  motionDuration,
  REDUCED_FADE_MS,
  type ReducedMotionPolicy,
  type ReducedMotionSource,
  type ReducedMotionSourceOptions,
  resolveMotionLevel,
  SUBTLE_DURATION_SCALE,
} from './preferences.ts';
export {
  createMotionPresence,
  type MotionPresence,
  type MotionPresenceOptions,
} from './presence.ts';
export {
  MAX_STAGGER_SPAN,
  MAX_TIMELINE_STEPS,
  type ParallelGroup,
  parallel,
  type StaggerOptions,
  sequence,
  stagger,
  type Timeline,
  type TimelineEntry,
  type TimelineOptions,
  type TimelineStep,
  timeline,
} from './sequence.ts';
export {
  createSharedElements,
  type ScopedViewTransitionOptions,
  type SharedElements,
  type SharedElementsOptions,
  startScopedViewTransition,
} from './shared.ts';
export * from './spring.ts';
