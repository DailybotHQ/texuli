// texuli/motion: the motion prop contract, MotionProvider and the seams the
// styled components animate through (ADR-013). The runtime itself loads on
// demand, so importing this costs a page almost nothing.
export {
  DEFAULT_MOTION_SETTINGS,
  getMotionSettings,
  type MotionSettings,
  setMotionSettings,
} from './context.ts';
export {
  type ComponentMotion,
  isMotionLevelName,
  isMotionPreset,
  lowerLevel,
  MOTION_DURATION_NAMES,
  MOTION_LEVEL_NAMES,
  MOTION_PRESETS,
  type MotionDurationName,
  type MotionLevel,
  type MotionPreset,
  type MotionProp,
  type ResolvedComponentMotion,
  resolveComponentMotion,
} from './contract.ts';
export { default as MotionProvider } from './MotionProvider.svelte';
export {
  createIndicatorMotion,
  createListMotion,
  createOverlayMotion,
  createPresenceMotion,
  createSizeMotion,
  loadMotionRuntime,
  type MotionHold,
  motionRuntime,
  type OverlayMotionHooks,
} from './seam.ts';
