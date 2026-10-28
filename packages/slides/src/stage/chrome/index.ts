/**
 * Stage chrome: the toolbar (registry controls, slide list, tooltips, More),
 * the progress bar and the layers over the stage (blackout, laser, help,
 * first-visit hint, full screen overlay, toast). Every chrome component reads
 * `getDeckStageContext()` and `getDeckChromeContext()` and marks its root
 * with `data-tx-deck-chrome`, so clicks and swipes on it never move the deck.
 */
export { default as DeckChrome } from './DeckChrome.svelte';
export { default as DeckProgress } from './DeckProgress.svelte';
export { default as DeckToolbar } from './DeckToolbar.svelte';
export { claimFirstRunHint, FIRST_RUN_HINT_MS, firstRunHintAllowed } from './first-run.ts';
export {
  copyDeckText,
  deckChromeEnvironment,
  deckPrintLink,
  deckShortcutText,
  deckSlideLink,
} from './links.ts';
export { DECK_CHROME_MESSAGES } from './messages.ts';
export {
  createDeckChromeState,
  type DeckChromeNotice,
  DeckChromeState,
  getDeckChromeContext,
  runDeckChromeAction,
  setDeckChromeContext,
} from './state.svelte.ts';
// The tooltip runtime loads lazily (first hover or focus); its types are public.
export type { DeckTooltip, DeckTooltipContent } from './tooltip.ts';
