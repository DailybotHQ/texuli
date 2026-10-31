/**
 * The default catalog theme loader (G127): the full token theme library
 * (`@texuli/tokens/library-expand`, port and expanded sets), imported on
 * first use so a bundle does not carry the theme records up front.
 *
 * Only the default entries reference it: `DeckStage`, `DeckPrint` and
 * `DeckPrintView` use it when the host passes no `loadTheme`. The core
 * entries (`@texuli/slides/stage-core`, `@texuli/slides/export-core`) have
 * no default loader, so a host that injects its own, or none, has no
 * reference to the library in its build, not even a lazy chunk. A core host
 * that wants the library opts in by name: `loadTheme={loadDeckLibraryTheme}`.
 */
import type { DeckThemeLoader } from './theme.ts';

export const loadDeckLibraryTheme: DeckThemeLoader = async (id) => {
  const { loadFullLibraryTheme } = await import('@texuli/tokens/library-expand');
  return loadFullLibraryTheme(id);
};
