/**
 * Everything the stage imports on first use, imported at once: the default
 * renderer tables with every layout and registry painter, the built-in block
 * support (block check and free-slide renderer), `migrateDeck`, and the six
 * block families. A browser loads these lazily (a loading status until they
 * arrive); a server render is synchronous, so a server build runs this before
 * it renders (`./ssr-server.ts`) and the HTML keeps the slides for no-JS
 * readers and crawlers. Only the server entry imports this module: none of it
 * reaches a browser bundle.
 */
import { CATALOG_NODE_RENDERER } from '../components/catalog-node.ts';
import { DECK_BLOCK_CATALOG_IDS } from '../grammar/index.ts';
import { LAYOUT_RENDERER_ENTRIES } from '../layouts/index.ts';
import { REGISTRY_RENDERER_ENTRIES } from '../registry/entries.ts';
import { BUILTIN_FREE_RENDERER, loadBuiltinDeckBlocks } from './builtin-loader.ts';
import { loadDefaultDeckRenderers } from './defaults.ts';
import { loadDeckBlockFamily } from './loaders.ts';
import { loadDeckMigration } from './migration.ts';
import { type DeckRendererEntry, loadRenderer } from './renderers.ts';

/**
 * Load the stage's lazy code once. Resolves to false when any part failed to
 * load (those parts keep their loading status in the render); never rejects.
 */
export async function preloadDeckStage(): Promise<boolean> {
  const entries: DeckRendererEntry<never>[] = [
    ...new Set<DeckRendererEntry<never>>(
      Object.values(LAYOUT_RENDERER_ENTRIES) as DeckRendererEntry<never>[]
    ),
    ...(Object.values(REGISTRY_RENDERER_ENTRIES) as DeckRendererEntry<never>[]),
    CATALOG_NODE_RENDERER as DeckRendererEntry<never>,
    BUILTIN_FREE_RENDERER as DeckRendererEntry<never>,
  ];
  const results = await Promise.allSettled([
    loadDefaultDeckRenderers(),
    loadBuiltinDeckBlocks().then((blocks) => {
      if (!blocks.ok) throw new Error('The built-in block support did not load.');
    }),
    loadDeckMigration().then((migrate) => {
      if (!migrate) throw new Error('migrateDeck did not load.');
    }),
    ...entries.map((entry) => loadRenderer(entry)),
    ...DECK_BLOCK_CATALOG_IDS.map((id) => loadDeckBlockFamily(id)),
  ]);
  return results.every((result) => result.status === 'fulfilled');
}
