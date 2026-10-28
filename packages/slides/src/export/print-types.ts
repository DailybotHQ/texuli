/**
 * The props of `DeckPrintView` (types only: the view itself loads its body
 * on first use, so the export entry stays small).
 */
import type { Deck, DeckSlide } from '@texuli/deck/model';
import type { Snippet } from 'svelte';
import type { DeckMediaTrust } from '../stage/media.ts';
import type { DeckStageMessages } from '../stage/messages.ts';
import type { DeckRenderers } from '../stage/renderers.ts';
import type { DeckThemeLoader } from '../stage/theme.ts';
import type { DeckPrintNotes, DeckPrintPlan } from './api.ts';

export interface DeckPrintViewProps {
  /** A validated v2 deck (`prepareDeck(input).deck`). */
  deck: Deck;
  /** `none` (default), `appendix` (notes after the slides) or `handout` (notes only). */
  notes?: DeckPrintNotes;
  /** Paint each slide yourself (slide, index into `deck.slides`); replaces the default renderers. */
  slide?: Snippet<[DeckSlide, number]>;
  /** v1 name of `slide`. */
  children?: Snippet<[DeckSlide, number]>;
  /** Extra renderer tables ahead of the default layouts and component registry. */
  renderers?: DeckRenderers | readonly DeckRenderers[];
  /**
   * Append the default tables (the 20 catalog layouts, the component
   * registry) after `renderers`, imported on first use. Default true; `false`
   * leaves every page to `renderers` and never loads the defaults.
   */
  defaultRenderers?: boolean;
  /** URL policy tier for media and links; keep `untrusted` for agent decks. */
  tier?: DeckMediaTrust;
  messages?: DeckStageMessages;
  /** Catalog theme loader (`null` when the host loads theme CSS itself). */
  loadTheme?: DeckThemeLoader | null;
  resolveAvatar?: (id: string) => string | undefined;
  /** Hosts keep this false until their own content (chart snapshots, fonts) is ready. */
  contentReady?: boolean;
  /** Called once every page has settled (`data-print-ready="true"`). */
  onReady?: (plan: DeckPrintPlan) => void;
  onError?: (error: unknown) => void;
  /** Longest wait for renderers and images before reporting ready anyway. */
  mediaTimeoutMs?: number;
  /**
   * When printing, hide the rest of the host page and its margins so page 1
   * is slide 1. Default true; turn off when the host prints its own frame.
   */
  isolate?: boolean;
}
