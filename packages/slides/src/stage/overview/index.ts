/**
 * Stage overview: the windowed thumbnail grid (`DeckOverview`) and its pure
 * helpers (columns per width, grid keyboard moves, the mounted window). It
 * reads `getDeckStageContext()`; thumbnails paint with the stage renderers
 * through a `DeckPreviewPaint`.
 */
export { default as DeckOverview } from './DeckOverview.svelte';
export {
  isOverviewMoveKey,
  moveOverviewSelection,
  OVERVIEW_BREAKPOINTS,
  OVERVIEW_WINDOW_RADIUS,
  overviewColumns,
  overviewWindow,
} from './window.ts';
