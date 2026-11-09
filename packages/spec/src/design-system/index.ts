/**
 * `@texuli/spec/design-system` — the design-system document contract
 * (ADR-021): the generated types, the closed vocabulary's codes and caps,
 * `validateDesignSystem` with JSON paths, `DesignSystemPatch` with its check
 * and pure merge, `migrateDesignSystem` and the blueprint reference check.
 * Framework-free and dependency-free; the compiler lives in
 * `@texuli/tokens/design-system/compile`.
 */

export type * from '../../generated/typescript/design-system.ts';
export type * from '../../generated/typescript/design-system-bundle.ts';
export {
  checkDesignSystemAllow,
  type DesignSystemAllowCatalog,
  type DesignSystemAllowCatalogComponent,
  type DesignSystemAllowCode,
} from './allow.ts';
export {
  APPROVAL_NOTE,
  type ApproveDesignSystemOptions,
  type ApproveDesignSystemResult,
  approveDesignSystem,
} from './approve.ts';
export {
  type DesignSystemRootAttributes,
  type DesignSystemRootAxes,
  DS_COMPONENT_ATTRIBUTE,
  DS_DENSITY_ATTRIBUTE,
  DS_SIZE_ATTRIBUTE,
  DS_TONE_ATTRIBUTE,
  DS_VARIANT_ATTRIBUTE,
  dsRootAttributes,
} from './attributes.ts';
export { checkBlueprintAllow } from './blueprint-allow.ts';
export {
  allowManifestFromDocument,
  bundleCanonicalJson,
  DESIGN_SYSTEM_BUNDLE_CODES,
  DESIGN_SYSTEM_BUNDLE_FORMAT,
  DESIGN_SYSTEM_BUNDLE_LIMITS,
  DESIGN_SYSTEM_BUNDLE_VERSION,
  type DesignSystemBundleCode,
  type DesignSystemBundleIssue,
  type DesignSystemBundleValidation,
  type PackBundleInput,
  type PackBundleResult,
  type PackHistoryEntry,
  type PackLibrarySource,
  packBundle,
  type UnpackBundleResult,
  unpackBundle,
  validateBundle,
} from './bundle.ts';
export {
  APPROVAL_HASH_EXCLUDED,
  canonicalJson,
  designSystemContentHash,
  libraryEntryContentHash,
  sha256Hex,
} from './hash.ts';
export {
  fullAllowEntry,
  type InitLockedDesignSystemOptions,
  type InitLockedDesignSystemResult,
  initLockedDesignSystem,
  LOCKED_PRESETS,
  type LockedPreset,
  lockedAllowPreset,
  MINIMAL_LOCKED_COMPONENTS,
} from './init.ts';
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
  DESIGN_SYSTEM_ALLOW_CODES,
  DESIGN_SYSTEM_CODES,
  DESIGN_SYSTEM_COMPILER_CODES,
  DESIGN_SYSTEM_FORMAT,
  DESIGN_SYSTEM_FORMAT_VERSION,
  DESIGN_SYSTEM_LIMITS,
  type DesignSystemCode,
} from './vocabulary.ts';
