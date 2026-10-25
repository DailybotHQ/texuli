/**
 * Default palette sources: every Tier U manifest the player's catalog holds
 * (content families, content layouts, the G20 layouts, the host region, the
 * state-only controls, flows, action forms and the chat display ids), its
 * loader map, and the reason each one this builder cannot insert is
 * unavailable. Imports only `@texuli/catalog` and `@texuli/player`.
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
import {
  ACTION_MANIFESTS,
  CHAT_DISPLAY_MANIFESTS,
  CONTROL_MANIFESTS,
  FLOW_MANIFESTS,
  G20_LAYOUT_MANIFESTS,
  PLAYER_LOADERS,
  REGION_MANIFESTS,
} from '@texuli/player';

export const PALETTE_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  ...CONTENT_MANIFESTS,
  pageLayoutManifest,
  docLayoutManifest,
  deckLayoutManifest,
  deckSlideManifest,
  cardLayoutManifest,
  gridLayoutManifest,
  ...G20_LAYOUT_MANIFESTS,
  ...REGION_MANIFESTS,
  ...CONTROL_MANIFESTS,
  ...FLOW_MANIFESTS,
  ...ACTION_MANIFESTS,
  ...CHAT_DISPLAY_MANIFESTS,
]);

export function playerPaints(id: string): boolean {
  return Object.hasOwn(PLAYER_LOADERS, id);
}

const DECK =
  'Decks need slide, master and settings editing; this builder edits page trees only, so decks are not insertable yet.';
const STATE =
  'Sets a state variable declared in the blueprint envelope; this builder edits the tree only and cannot declare state yet.';
const FLOW =
  'Belongs to a flow (views and events) declared in the blueprint envelope; this builder cannot declare flows yet.';
const ACTION =
  'Proposes an action declared in the blueprint envelope; this builder cannot declare actions yet.';

/** Why a painted Tier U id is not insertable in this builder. */
const UNAVAILABLE_REASONS: Readonly<Record<string, string>> = Object.freeze({
  'layout-deck': DECK,
  'deck-slide': DECK,
  'control-toggle': STATE,
  'control-choice': STATE,
  'control-slider': STATE,
  'control-filter': STATE,
  'flow-view': FLOW,
  'flow-action': FLOW,
  'action-form': ACTION,
  'form-field': ACTION,
  'form-submit': ACTION,
});

export function unavailableReason(id: string): string | undefined {
  if (!playerPaints(id)) {
    return id.startsWith('chat-')
      ? 'The player has no painter for chat display ids; a chat host paints them.'
      : undefined;
  }
  return UNAVAILABLE_REASONS[id];
}
