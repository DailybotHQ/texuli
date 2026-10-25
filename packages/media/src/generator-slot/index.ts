/**
 * Framework-free generator-slot model (T-media-generator-slot).
 * The Svelte control lives on `@texuli/media/generator-slot` (`entry.ts`).
 * Texuli ships no model and opens no network — the host provides `generate`.
 */

export {
  buildRequest,
  DEFAULT_GENERATOR_SLOT_LABELS,
  GENERATOR_SLOT_LIMITS,
  normalizeKind,
  normalizePrompt,
  type RunGeneratorOutcome,
  resolveGeneratorSlotLabels,
  runGenerator,
  sanitizeGeneratorResult,
  statusMessage,
} from './model.ts';
export {
  MEDIA_GENERATE_REQUEST_ID,
  MEDIA_GENERATION_REQUEST_ASPECT_RATIOS,
  type MediaGenerationAspectRatio,
  type MediaGenerationRequestNode,
  type MediaGenerationRequestParseResult,
  parseMediaGenerationRequest,
} from './request-node.ts';
export type {
  GeneratorFailureReason,
  GeneratorKind,
  GeneratorRequest,
  GeneratorResult,
  GeneratorSlotLabels,
  GeneratorSlotProps,
  GeneratorSlotStatus,
  GeneratorTrust,
  MediaGenerationOptions,
  MediaGenerationOptionValue,
  MediaGenerator,
  MediaProvenance,
  MediaProvenanceSource,
  SafeGeneratorOutput,
} from './types.ts';
