import type { CatalogManifest } from '@texuli/catalog';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  docLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { G20_LAYOUT_MANIFESTS, PLAYER_LOADERS, REGION_MANIFESTS } from '@texuli/player';

/**
 * What the builder inserts: Tier U manifests the player paints and every
 * prop of which has a working inspector field. Decks, controls, flows and
 * action forms also need envelope declarations (slides, state, flows,
 * actions) the builder cannot author, so the palette lists them as
 * unavailable with that reason (`palette/sources.ts`).
 */
export const BUILDER_MANIFESTS: readonly CatalogManifest[] = Object.freeze(
  [
    ...CONTENT_MANIFESTS,
    cardLayoutManifest,
    pageLayoutManifest,
    docLayoutManifest,
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
