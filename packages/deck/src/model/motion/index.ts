/**
 * Slide transitions and fragment motion of deck model v2 (model-v2 §3.1,
 * §3.2): precedence slide → deck → `fade`, the motion ceiling and the
 * reduced-motion floor, capped at `MAX_MOTION_MS`.
 */
export {
  DEFAULT_MOTION,
  DEFAULT_TRANSITION,
  type DeckSlideTransition,
  effectiveMotion,
  FRAGMENT_MS,
  type FragmentMotionOptions,
  type FragmentMotionReason,
  isDeckTransition,
  isMotionLevel,
  MAX_MOTION_MS,
  MOTION_LEVELS,
  type MotionLevel,
  type MotionOptions,
  REDUCED_FADE_MS,
  type ResolvedFragmentMotion,
  type ResolvedTransition,
  resolveDeckTransitions,
  resolveFragmentMotion,
  resolveSlideTransition,
  type SlideTransitionInput,
  SUBTLE_SCALE,
  TRANSITION_MS,
  type TransitionDeck,
  type TransitionReason,
  type TransitionSlide,
} from './transition.ts';
