/**
 * Default palette sources: every Tier U manifest the player's catalog holds
 * (content families, content layouts, and the catalog's composition, state,
 * chat, data and workflows groups), its loader map, and the reason each one
 * this builder cannot insert is unavailable. Imports only `@texuli/catalog`
 * and `@texuli/player`.
 */
import type { CatalogManifest } from '@texuli/catalog';
import { CHAT_MANIFESTS } from '@texuli/catalog/manifests/chat';
import { COMPOSITION_MANIFESTS } from '@texuli/catalog/manifests/composition';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DATA_MANIFESTS } from '@texuli/catalog/manifests/data';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  deckSlideManifest,
  docLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { STATE_MANIFESTS } from '@texuli/catalog/manifests/state';
import { WORKFLOWS_MANIFESTS } from '@texuli/catalog/manifests/workflows';
import { PLAYER_LOADERS } from '@texuli/player';

export const PALETTE_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  ...CONTENT_MANIFESTS,
  pageLayoutManifest,
  docLayoutManifest,
  deckLayoutManifest,
  deckSlideManifest,
  cardLayoutManifest,
  gridLayoutManifest,
  ...COMPOSITION_MANIFESTS,
  ...STATE_MANIFESTS,
  ...CHAT_MANIFESTS,
  ...DATA_MANIFESTS,
  ...WORKFLOWS_MANIFESTS,
]);

export function playerPaints(id: string): boolean {
  return Object.hasOwn(PLAYER_LOADERS, id);
}

const DECK =
  'A deck is a whole draft: start one from the Planning deck starter. The palette does not insert a deck inside a draft.';
const SLIDE =
  'Deck slides need the slide editor (planned); the deck starter uses card slides, which this builder edits.';
const STATE =
  'Sets a state variable declared in the blueprint envelope; this builder edits the tree only and cannot declare state yet.';
const FLOW =
  'Belongs to a flow (views and events) declared in the blueprint envelope; this builder cannot declare flows yet.';
const ACTION =
  'Proposes an action declared in the blueprint envelope; this builder cannot declare actions yet.';
const LIST =
  'Reorders a list variable declared in the blueprint envelope (drag as data); this builder cannot declare state yet.';

/** Why a painted Tier U id is not insertable in this builder. */
const UNAVAILABLE_REASONS: Readonly<Record<string, string>> = Object.freeze({
  'layout-deck': DECK,
  'deck-slide': SLIDE,
  'control-toggle': STATE,
  'control-choice': STATE,
  'control-slider': STATE,
  'control-filter': STATE,
  'flow-view': FLOW,
  'flow-action': FLOW,
  'action-form': ACTION,
  'form-field': ACTION,
  'form-submit': ACTION,
  'sortable-list': LIST,
});

export function unavailableReason(id: string): string | undefined {
  if (!playerPaints(id)) return undefined;
  return UNAVAILABLE_REASONS[id];
}
