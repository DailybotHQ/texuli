/**
 * `@texuli/tokens/design-system/compile` (ADR-021, ADR-022): resolve and
 * compile design-system documents into concrete `--tx-*` variables per mode,
 * with enforced contrast, focus and target guarantees. A lazy entry: the
 * `@texuli/tokens` root never imports it, and library themes for
 * `extends: "texuli:<id>"` load in their own chunks.
 *
 * The library-free form is `@texuli/tokens/design-system/compile-core`
 * (G127): this entry is that one plus `loadLibraryBase` and
 * `resolveDesignSystem`, which default `texuli:<id>` bases to the library.
 */

export * from './compile-core.ts';
export { loadLibraryBase, resolveDesignSystem } from './resolve-library.ts';
