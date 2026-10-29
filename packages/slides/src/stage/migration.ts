/**
 * `migrateDeck`, imported by the stage on first use (`loadDeckMigration`):
 * only a deck in an earlier shape (Texuli v1, a grammar tree, a Protoyard
 * deck) needs it, so a v2 deck never loads the migration code.
 */
import type { DeckMigrate } from './prepare-core.ts';

let loaded: DeckMigrate | undefined;
let loading: Promise<DeckMigrate | null> | undefined;

/**
 * Import `migrateDeck` once (later calls share the import). Never rejects:
 * a failed import resolves to `null` (the stage refuses the deck) and is
 * retried by the next call.
 */
export function loadDeckMigration(): Promise<DeckMigrate | null> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import('./migrate-chunk.ts').then(
    (model) => {
      loaded = model.migrateDeck;
      return loaded;
    },
    () => {
      loading = undefined;
      return null;
    }
  );
  return loading;
}

/** `migrateDeck` when it has already loaded, synchronously. */
export function loadedDeckMigration(): DeckMigrate | undefined {
  return loaded;
}
