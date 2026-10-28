/**
 * Stage presenter: the in-page split view (`DeckPresenterPane`), its pieces
 * (notes, up next, status with timers, previous and next), live slide
 * previews, the timers and the presenter window session over
 * `@texuli/deck/engine` presenter protocol v1. The previews, timers, buttons
 * and session load lazily (`./extras.ts`), and the window's own view and
 * document builder (`./popup.ts`) load when the window opens.
 */
export { default as DeckPresenterPane } from './DeckPresenterPane.svelte';
export { default as DeckSlidePreview } from './DeckSlidePreview.svelte';
export type { DeckPresenterHost } from './host.ts';
export { default as PresenterNav } from './PresenterNav.svelte';
export { default as PresenterNotes } from './PresenterNotes.svelte';
export { default as PresenterStatus } from './PresenterStatus.svelte';
export { default as PresenterUpNext } from './PresenterUpNext.svelte';
export {
  type DeckPreviewPaint,
  lastStep,
  type PresenterPosition,
  presenterPosition,
  previewScale,
  stepLabel,
} from './paint.ts';
export {
  createDeckPresenterSession,
  DECK_PRESENTER_WINDOW_FEATURES,
  type DeckPresenterFallbackReason,
  type DeckPresenterOpenInput,
  type DeckPresenterOpenWindow,
  type DeckPresenterSession,
  type DeckPresenterSessionOptions,
  presenterSessionFor,
  presenterWindowName,
} from './session.svelte.ts';
export {
  createDeckPresenterTimers,
  type DeckPresenterTimers,
  deckPresenterTimers,
  formatWallClock,
} from './timers.ts';
