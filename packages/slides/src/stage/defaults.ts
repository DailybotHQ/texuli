/**
 * The default renderer tables, imported on first use. The stage and the
 * print view call `loadDefaultDeckRenderers()` only when their
 * `defaultRenderers` option is on, so the layouts table and the component
 * registry (and the catalog outline it validates with) stay out of a host's
 * initial JavaScript otherwise. After the first import, every stage reads
 * them synchronously (`loadedDefaultDeckRenderers()`), so later stages
 * paint on their first render. A host that wants the first stage to paint
 * at once awaits `loadDefaultDeckRenderers()` before mounting it.
 *
 * The default tables bring no block check, so the same call also imports
 * the stage's built-in block support (`loadBuiltinDeckBlocks`: the default
 * `validateDeckBlock` and the built-in free-slide renderer) and
 * `migrateDeck` (for decks in an earlier shape), keeping "await the
 * defaults, then mount" a first-render paint for every input.
 */
import { loadBuiltinDeckBlocks } from './builtin-loader.ts';
import { loadDeckMigration } from './migration.ts';
import type { DeckRenderers } from './renderers.ts';

let loaded: readonly DeckRenderers[] | undefined;
let loading: Promise<readonly DeckRenderers[]> | undefined;

/** Import the default tables once; later calls share the import. */
export function loadDefaultDeckRenderers(): Promise<readonly DeckRenderers[]> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= Promise.all([
    import('./default-renderers.ts'),
    loadBuiltinDeckBlocks(),
    loadDeckMigration(),
  ]).then(
    ([module]) => {
      loaded = module.DEFAULT_DECK_RENDERERS;
      return loaded;
    },
    (error: unknown) => {
      // A failed chunk can be retried by the next stage.
      loading = undefined;
      throw error;
    }
  );
  return loading;
}

/** The default tables when they have already loaded, synchronously. */
export function loadedDefaultDeckRenderers(): readonly DeckRenderers[] | undefined {
  return loaded;
}
