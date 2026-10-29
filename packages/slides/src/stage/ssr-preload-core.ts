/**
 * The lazy code of `DeckStageCore`, imported at once for a server render: the
 * built-in block support (block check and free-slide renderer), `migrateDeck`
 * and the six block families. Never the default renderer tables (those are
 * `DeckStage`'s, in `./ssr-preload.ts`), so a server build of the core alone
 * emits none of their code or CSS. Only server entries import this module.
 */
import { DECK_BLOCK_CATALOG_IDS } from '../grammar/index.ts';
import { BUILTIN_FREE_RENDERER, loadBuiltinDeckBlocks } from './builtin-loader.ts';
import { loadDeckBlockFamily } from './loaders.ts';
import { loadDeckMigration } from './migration.ts';
import { type DeckRendererEntry, loadRenderer } from './renderers.ts';

/** The core's lazy parts, settled; `true` when every part loaded. Never rejects. */
export async function preloadDeckStageCore(): Promise<boolean> {
  const results = await Promise.allSettled([
    loadBuiltinDeckBlocks().then((blocks) => {
      if (!blocks.ok) throw new Error('The built-in block support did not load.');
    }),
    loadDeckMigration().then((migrate) => {
      if (!migrate) throw new Error('migrateDeck did not load.');
    }),
    loadRenderer(BUILTIN_FREE_RENDERER as DeckRendererEntry<never>),
    ...DECK_BLOCK_CATALOG_IDS.map((id) => loadDeckBlockFamily(id)),
  ]);
  return results.every((result) => result.status === 'fulfilled');
}
