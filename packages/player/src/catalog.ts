import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { renderCatalogFromSpecs } from '@texuli/catalog/render/renderer';
import { PLAYER_RENDER_SPECS } from './render-specs.ts';

/**
 * Default catalog: the shipped content families, the content layouts, and
 * the catalog's composition, state, chat, data and workflows groups (spec
 * 0.3.0): every agent-emittable id, with its events and bindable props.
 * Built from the generated lean specs (`scripts/render-specs.ts`), so the
 * manifests' prose and examples stay out of the player's eager chunk.
 */
export function createPlayerCatalog(): RenderCatalog {
  return renderCatalogFromSpecs(PLAYER_RENDER_SPECS);
}

export type { RenderCatalog };
