/**
 * `@texuli/tokens/design-system/compile-core` (G127): the design-system
 * compiler without the theme library. Every export of
 * `@texuli/tokens/design-system/compile` except `loadLibraryBase` and
 * `resolveDesignSystem`; resolution is `resolveDesignSystemCore`, which
 * loads a `texuli:<id>` base only through the injected `loadLibraryBase`
 * (without one such a base is refused: `invalid-value`, "Nothing resolves
 * texuli:<id>"). A host that injects its own loader, or none, has no
 * reference to the theme library in its build, not even a lazy chunk.
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
  type DesignSystemLibraryLoader,
  type DesignSystemResolver,
  type ResolveDesignSystemCoreOptions,
  type ResolveDesignSystemOptions,
  type ResolvedDesignSystem,
  resolveDesignSystemCore,
  resolveDesignSystemSync,
} from './resolve.ts';
