/**
 * `@texuli/spec/design-system` — the design-system document contract
 * (ADR-021): the generated types, the closed vocabulary's codes and caps,
 * `validateDesignSystem` with JSON paths, `DesignSystemPatch` with its check
 * and pure merge, `migrateDesignSystem` and the blueprint reference check.
 * Framework-free and dependency-free; the compiler lives in
 * `@texuli/tokens/design-system/compile`.
 */

export type * from '../../generated/typescript/design-system.ts';
export {
  applyDesignSystemPatch,
  checkDesignSystemReference,
  DESIGN_SYSTEM_MIGRATIONS,
  type DesignSystemMigration,
  type DesignSystemMigrationResult,
  type DesignSystemPatch,
  type DesignSystemValidateOptions,
  type DesignSystemValidation,
  migrateDesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from './validate.ts';
export {
  DESIGN_SYSTEM_CODES,
  DESIGN_SYSTEM_COMPILER_CODES,
  DESIGN_SYSTEM_FORMAT,
  DESIGN_SYSTEM_FORMAT_VERSION,
  DESIGN_SYSTEM_LIMITS,
  type DesignSystemCode,
} from './vocabulary.ts';
