export type { CompositionProvenanceEntry, MediaProvenance } from '../provenance.ts';
export { collectCompositionProvenance } from '../provenance.ts';
export type {
  Composition,
  CompositionBlendMode,
  CompositionFrame,
  CompositionIssue,
  CompositionLayer,
  CompositionMask,
  CompositionPaint,
  CompositionTransform,
  CompositionValidation,
  GradientStop,
  ImageLayer,
  LinearGradientPaint,
  RadialGradientPaint,
  ShapeLayer,
  SolidPaint,
  TextLayer,
  ValidateCompositionOptions,
} from './types.ts';
export { COMPOSITION_LIMITS, validateComposition } from './validate.ts';
