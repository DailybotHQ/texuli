/**
 * The default theme library loaders (G127): the full token theme library
 * (`@texuli/tokens/library-expand`, port and expanded sets), imported on
 * first use so a bundle does not carry the theme records up front.
 *
 * - `loadDeckLibraryTheme` resolves catalog theme ids (`loadTheme`).
 * - `loadDeckLibraryBase` resolves a deck design system's `texuli:<theme>`
 *   reference or `extends` base (`loadLibraryBase`).
 *
 * Only the default entries reference them: `DeckStage` (both), `DeckPrint`
 * and `DeckPrintView` (`loadTheme`) use them when the host passes none. The
 * core entries (`@texuli/slides/stage-core`, `@texuli/slides/export-core`)
 * have no default, so a host that injects its own loaders, or none, has no
 * reference to the library in its build, not even a lazy chunk. A core host
 * that wants the library opts in by name:
 * `loadTheme={loadDeckLibraryTheme}` and `loadLibraryBase={loadDeckLibraryBase}`.
 */
import type { DeckLibraryBaseLoader, DeckThemeLoader } from './theme.ts';

export const loadDeckLibraryTheme: DeckThemeLoader = async (id) => {
  const { loadFullLibraryTheme } = await import('@texuli/tokens/library-expand');
  return loadFullLibraryTheme(id);
};

export const loadDeckLibraryBase: DeckLibraryBaseLoader = async (ref) => {
  const { loadLibraryBase } = await import('@texuli/tokens/design-system/compile');
  return loadLibraryBase(ref);
};
