/**
 * Stage chrome. PHASE-1 PLACEHOLDERS (PLAN_008 T-stage): a minimal toolbar
 * and the progress bar. Phase 2 owns this directory and replaces them with
 * the full chrome; every chrome component reads `getDeckStageContext()` and
 * marks its root with `data-tx-deck-chrome` so clicks and swipes on it never
 * move the deck.
 */
export { default as DeckProgress } from './DeckProgress.svelte';
export { default as DeckToolbar } from './DeckToolbar.svelte';
