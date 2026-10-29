/**
 * The catalog node painter of the registry's free renderer, imported only
 * when a family block needs the player. A module of its own, so a server
 * build can preload it (`../stage/ssr-preload.ts`).
 */
import type { DeckLazyRenderer, DeckSlideRenderContext } from '../stage/renderers.ts';

export interface CatalogNodeProps extends Record<string, unknown> {
  id: string;
  props: Record<string, unknown>;
  context: DeckSlideRenderContext;
  stateKey: string;
  label: string;
}

export const CATALOG_NODE_RENDERER = {
  load: () => import('./CatalogNode.svelte'),
} as unknown as DeckLazyRenderer<CatalogNodeProps>;
