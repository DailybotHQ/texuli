/**
 * Default palette sources: the player's catalog manifests (content families,
 * content layouts and chat display ids) and its loader map. Imports only
 * `@texuli/catalog` and `@texuli/player`.
 */
import type { CatalogManifest } from '@texuli/catalog';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  deckSlideManifest,
  docLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { CHAT_DISPLAY_MANIFESTS, PLAYER_LOADERS } from '@texuli/player';

export const PALETTE_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  ...CONTENT_MANIFESTS,
  pageLayoutManifest,
  docLayoutManifest,
  deckLayoutManifest,
  deckSlideManifest,
  cardLayoutManifest,
  gridLayoutManifest,
  ...CHAT_DISPLAY_MANIFESTS,
]);

export function playerPaints(id: string): boolean {
  return Object.hasOwn(PLAYER_LOADERS, id);
}
