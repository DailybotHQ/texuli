/**
 * Host seam for painting a `layout-deck` blueprint on a presentation stage.
 *
 * The player (L7) cannot import `@texuli/slides` (L8). A host that owns both
 * packages supplies a {@link DeckPlayerHost}: the player validates the tree
 * as today, then hands the deck root to the host instead of painting it as a
 * document. Without a host the player keeps the document-flow layout.
 *
 * The slides stage wires a real adapter (`createSlidesDeckPlayerHost` or
 * equivalent) around `DeckStage`. Tests use a mock host.
 */

import type { CatalogTreeInput, RenderNode, RenderTier } from '@texuli/catalog/render/renderer';

/** Read-only snapshot the player hands a deck host. */
export interface DeckPlayerHostRequest {
  /** The validated layout-deck tree (or its render root). */
  tree: CatalogTreeInput | RenderNode;
  /** Host-chosen tier (never from the draft). */
  tier: RenderTier;
  /** Accessible name of the player region. */
  label: string;
  /** False while the enclosing surface is inactive (`inert`). */
  active: boolean;
  /** Optional player root element the host may measure against. */
  root?: HTMLElement | null;
}

/**
 * A host that can present a deck blueprint on a stage-like surface.
 * `present` may return a cleanup; the player calls it when the blueprint,
 * tier or host identity changes, and on destroy.
 */
export interface DeckPlayerHost {
  present(request: DeckPlayerHostRequest): undefined | (() => void);
}

/** True when a catalog tree (or render root) is a layout-deck. */
export function isLayoutDeckTree(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.id === 'layout-deck') return true;
  // RenderNode form: { kind: 'component', id: 'layout-deck', ... }
  return record.kind === 'component' && record.id === 'layout-deck';
}

/**
 * Record that the full stage rendering is owned by `@texuli/slides`: a host
 * that imports both packages builds a {@link DeckPlayerHost} around the stage
 * and passes it as `deckHost` on `Player`. This constant is the stable pointer
 * tests and docs use; it is not a runtime import of the stage.
 */
export const DECK_STAGE_HOST_PACKAGE = '@texuli/slides' as const;
