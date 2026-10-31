/**
 * The theme library loader for a document's design system (G127): resolves a
 * `texuli:<theme>` reference or `extends` base from the token theme library,
 * imported on first use. The default entries (`reader`, `host` and the root)
 * hand it to the reader; the core entries never reference it unless the host
 * opts in by name (`loadLibraryBase={loadPagesLibraryBase}`), so a core host
 * with no loader has no theme library module in its build.
 */
import type { PagesLibraryBaseLoader } from './design-system-types.ts';

export const loadPagesLibraryBase: PagesLibraryBaseLoader = async (ref) => {
  const { loadLibraryBase } = await import('@texuli/tokens/design-system/compile');
  return loadLibraryBase(ref);
};
