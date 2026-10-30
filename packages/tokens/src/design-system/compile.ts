/**
 * `@texuli/tokens/design-system/compile` (ADR-021, ADR-022): resolve and
 * compile design-system documents into concrete `--tx-*` variables per mode,
 * with enforced contrast, focus and target guarantees. A lazy entry: the
 * `@texuli/tokens` root never imports it, and library themes for
 * `extends: "texuli:<id>"` load in their own chunks.
 */

export {
  type CompileDesignSystemOptions,
  type CompiledDesignSystem,
  compileDesignSystem,
  DESIGN_SYSTEM_COMPILER_VERSION,
  type DesignSystemAdjustment,
  type DesignSystemFontFace,
  type DesignSystemReport,
  type DesignSystemTargetResult,
  type DesignSystemWarning,
} from './compiler.ts';
export {
  DEFAULT_DESIGN_SYSTEM_SEED,
  type DesignSystemBrand,
  type FromThemeLoss,
  type FromThemeOptions,
  formatFontStack,
  fromTheme,
  fromThemeWithReport,
  splitFontStack,
} from './from-theme.ts';
export {
  checkDesignSystemGuarantees,
  DESIGN_SYSTEM_ATTRIBUTES,
  DESIGN_SYSTEM_PAIRS,
  DESIGN_SYSTEM_TARGETS,
  type DesignSystemAttribute,
  type DesignSystemContrast,
  type DesignSystemGuaranteeInput,
  type DesignSystemMode,
  type DesignSystemPair,
  type DesignSystemPairResult,
  type DesignSystemTargets,
  evaluateDesignSystemContrast,
} from './guarantees.ts';
export { canonicalJson, sha256Hex } from './hash.ts';
export {
  type DesignSystemCompileIssue,
  type DesignSystemFailure,
  type DesignSystemResolver,
  loadLibraryBase,
  type ResolveDesignSystemOptions,
  type ResolvedDesignSystem,
  resolveDesignSystem,
  resolveDesignSystemSync,
} from './resolve.ts';
