export {
  sampleCompositionV2,
  validateAnimationV2,
} from './animation.ts';
export {
  compositionLeaves,
  type GroupState,
  type LayerWindow,
  resolveCompositionAt,
  resolveLayerWindows,
} from './resolve.ts';
export type {
  CompositionLayerV2,
  CompositionLeafV2,
  CompositionV2,
  CompositionV2Validation,
  GroupLayer,
  LayerTiming,
  ValidateCompositionV2Options,
} from './types.ts';
export { COMPOSITION_V2_LIMITS, upgradeComposition, validateCompositionV2 } from './validate.ts';
