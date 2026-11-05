// texuli/motion/loop: a looping motion that honors reduced motion (D-G-046).
// A subpath of its own, so the root barrel and texuli/motion do not grow.
export {
  loopDuration,
  loopStagger,
  MOTION_LOOP_PRESETS,
  MOTION_LOOP_STAGGERS,
  type MotionLoopInput,
  type MotionLoopPreset,
  type MotionLoopStagger,
  type MotionLoopState,
  resolveMotionLoop,
} from './loop.ts';
export { default as MotionLoop } from './MotionLoop.svelte';
