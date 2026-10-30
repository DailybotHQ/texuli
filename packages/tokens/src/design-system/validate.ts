/**
 * `@texuli/tokens/design-system/validate`: the spec's document checks
 * (`validateDesignSystem`, patches, migration) together with the compiler's
 * guarantee checks over compiled variables, so a host can re-check a cached
 * compiled design system without loading the compiler or the color engine.
 */

export {
  applyDesignSystemPatch,
  checkDesignSystemReference,
  DESIGN_SYSTEM_CODES,
  DESIGN_SYSTEM_COMPILER_CODES,
  DESIGN_SYSTEM_FORMAT,
  DESIGN_SYSTEM_FORMAT_VERSION,
  DESIGN_SYSTEM_LIMITS,
  type DesignSystem,
  type DesignSystemCode,
  type DesignSystemIssue,
  type DesignSystemPatch,
  type DesignSystemValidateOptions,
  type DesignSystemValidation,
  migrateDesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from '@texuli/spec/design-system';
export {
  checkDesignSystemGuarantees,
  DESIGN_SYSTEM_ATTRIBUTES,
  DESIGN_SYSTEM_PAIRS,
  DESIGN_SYSTEM_TARGETS,
  type DesignSystemAttribute,
  type DesignSystemContrast,
  type DesignSystemGuaranteeInput,
  type DesignSystemMode,
  type DesignSystemPairResult,
  type DesignSystemTargets,
  evaluateDesignSystemContrast,
  lengthPx,
  MIN_FOCUS_WIDTH,
} from './guarantees.ts';
