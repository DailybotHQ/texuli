import type { CatalogManifest } from '@texuli/catalog';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  docLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { PLAYER_LOADERS } from '@texuli/player';

/** The B0 palette is the intersection of Tier U manifests and player loaders. */
export const BUILDER_MANIFESTS: readonly CatalogManifest[] = Object.freeze(
  [
    ...CONTENT_MANIFESTS,
    cardLayoutManifest,
    pageLayoutManifest,
    docLayoutManifest,
    gridLayoutManifest,
  ]
    .filter((manifest) => manifest.agentEmittable === true && manifest.id in PLAYER_LOADERS)
    .sort((left, right) => left.id.localeCompare(right.id, 'en'))
);

export const BUILDER_MANIFEST_BY_ID = new Map(
  BUILDER_MANIFESTS.map((manifest) => [manifest.id, manifest])
);
