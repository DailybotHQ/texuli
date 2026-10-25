/** Pure keyframe animation API (no Svelte). UI: `@texuli/media/animation/player`. */
export { isHexColor, mixOklch } from './color.ts';
export { applyEasing, lerp } from './easing.ts';
export { sampleComposition } from './sample.ts';
export {
  type CompositionTimeline,
  type CreateTimelineOptions,
  createTimeline,
} from './timeline.ts';
export {
  ANIMATION_LIMITS,
  type AnimationValidation,
  type CompositionAnimation,
  EASING_NAMES,
  type EasingName,
  type LayerKeyframe,
  type LayerTrack,
  type SampleAnimationOptions,
  type TimelineListener,
  type TimelineState,
  type ValidateAnimationOptions,
} from './types.ts';
export { validateAnimation } from './validate.ts';
