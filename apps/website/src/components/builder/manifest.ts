import type { CatalogManifest } from '@texuli/catalog';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  docLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { G20_LAYOUT_MANIFESTS, PLAYER_LOADERS, REGION_MANIFESTS } from '@texuli/player';

/**
 * What the builder edits: Tier U manifests the player paints and every
 * prop of which has a working inspector field. Controls, flows and action
 * forms also need envelope declarations (state, flows, actions) the builder
 * cannot author, and a deck slide needs the deck editor, so the palette
 * lists them as unavailable with that reason (`palette/sources.ts`). A deck
 * is edited as a whole draft (`BUILDER_ROOT_ONLY`).
 */
export const BUILDER_MANIFESTS: readonly CatalogManifest[] = Object.freeze(
  [
    ...CONTENT_MANIFESTS,
    cardLayoutManifest,
    pageLayoutManifest,
    docLayoutManifest,
    deckLayoutManifest,
    gridLayoutManifest,
    ...G20_LAYOUT_MANIFESTS,
    ...REGION_MANIFESTS,
  ]
    .filter((manifest) => manifest.agentEmittable === true && manifest.id in PLAYER_LOADERS)
    .sort((left, right) => left.id.localeCompare(right.id, 'en'))
);

export const BUILDER_MANIFEST_BY_ID = new Map(
  BUILDER_MANIFESTS.map((manifest) => [manifest.id, manifest])
);

/**
 * Ids a draft may have as its root but the palette never inserts inside a
 * draft: a deck is a whole draft, started from the deck starter.
 */
export const BUILDER_ROOT_ONLY: ReadonlySet<string> = new Set(['layout-deck']);

/** What the palette inserts: every builder manifest except the root-only ones. */
export function builderInsertable(id: string): boolean {
  return BUILDER_MANIFEST_BY_ID.has(id) && !BUILDER_ROOT_ONLY.has(id);
}
