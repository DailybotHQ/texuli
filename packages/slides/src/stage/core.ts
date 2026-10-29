/**
 * `@texuli/slides/stage-core` (G72): the stage without the default renderer
 * tables. `DeckStageCore` is `DeckStage` with nothing behind its
 * `defaultRenderers` (it behaves as `defaultRenderers={false}`), so a host
 * that brings every renderer itself never references the catalog layouts or
 * the component registry, and its build emits none of their chunks or CSS.
 * Every other export is the same as `@texuli/slides/stage`, except
 * `DeckStage`, `DeckPrint` and the default-table loaders.
 */
export {
  type BuiltinDeckBlocks,
  loadBuiltinDeckBlocks,
  loadedBuiltinDeckBlocks,
} from './builtin-loader.ts';
export {
  claimFirstRunHint,
  copyDeckText,
  createDeckChromeState,
  DECK_CHROME_MESSAGES,
  DeckChrome,
  type DeckChromeNotice,
  DeckChromeState,
  DeckProgress,
  DeckToolbar,
  type DeckTooltip,
  type DeckTooltipContent,
  deckChromeEnvironment,
  deckPrintLink,
  deckShortcutText,
  deckSlideLink,
  FIRST_RUN_HINT_MS,
  firstRunHintAllowed,
  getDeckChromeContext,
  runDeckChromeAction,
  setDeckChromeContext,
} from './chrome/index.ts';
export {
  type DeckStageContext,
  type DeckStageSlideEntry,
  getDeckStageContext,
  getDeckStepContext,
  setDeckStageContext,
  setDeckStepContext,
} from './context.ts';
export { deckCssVars } from './css-vars.ts';
export { default as DeckStageCore } from './DeckStageCore.svelte';
export {
  DECK_STAGE_EVENTS,
  type DeckStageEvent,
  type DeckStageEventMap,
  type DeckStageEventName,
  dispatchDeckEvent,
} from './events.ts';
export {
  type ComposedFreeSlide,
  composeFreeSlide,
  type FreeSlideEntry,
  type FreeSlideRegion,
  freeSlideEntry,
} from './free.ts';
export { canUseNativeFullscreen, type DeckFullscreenState } from './fullscreen.ts';
export { clickInput, createSwipeTracker, keyInput, selectionLength } from './input.ts';
export { type DeckBlockRendererProps, loadDeckBlockFamily } from './loaders.ts';
export {
  type DeckMediaGate,
  type DeckMediaOptions,
  type DeckMediaTrust,
  deckAvatarResolver,
  gateDeckMedia,
  settleDeckImages,
} from './media.ts';
export {
  createDeckTranslator,
  DECK_STAGE_MESSAGES,
  type DeckStageMessageKey,
  type DeckStageMessages,
  type DeckStageOnlyMessageKey,
  type DeckTranslate,
} from './messages.ts';
export { loadDeckMigration, loadedDeckMigration } from './migration.ts';
export type { SlideNavigationIntent, SlideStepIntent } from './navigation.ts';
export { DeckOverview } from './overview/index.ts';
export { prefetchDeckSlides, slideBlockFamilies, whenIdle } from './prefetch.ts';
export {
  type DeckBlockCheck,
  type DeckValidationHooks,
  isPreparedDeck,
  type PreparedDeck,
  type PreparedDeckOk,
  prepareDeck,
  prepareDeckV2,
  validateDeckBlock,
} from './prepare.ts';
export { DeckPresenterPane } from './presenter/index.ts';
export { createPresenterTimer, formatElapsed, type PresenterTimer } from './presenter.ts';
export {
  type DeckBackgroundRendererProps,
  type DeckBlockValidator,
  type DeckBlockValidatorModule,
  type DeckDefaultRenderersSource,
  type DeckItemRendererProps,
  type DeckLazyRenderer,
  type DeckRendererEntry,
  type DeckRendererLookup,
  type DeckRenderers,
  type DeckSlideRenderContext,
  type DeckSlideRendererProps,
  deckRendererList,
  deckValidationHooks,
  deckValidatorsReady,
  isLazyRenderer,
  loadDeckValidators,
  loadRenderer,
  readyRenderer,
  resolveBackgroundRenderer,
  resolveItemRenderer,
  resolveSlideRenderer,
} from './renderers.ts';
export {
  claimDeckHash,
  type DeckRouteWindow,
  readDeckHash,
  releaseDeckHash,
  watchDeckHash,
  writeDeckHash,
} from './route.ts';
export {
  clampStep,
  createDeckStepContext,
  type DeckFragmentAttributes,
  type DeckStepContext,
  deckSlideSteps,
  deckStepView,
  type StepViewInput,
} from './steps.ts';
export {
  DECK_FALLBACK_PALETTES,
  deckBackgroundPalette,
  deckThemeId,
  deckThemeKey,
  deckThemeReferences,
  loadDeckTheme,
  resolveStageMode,
  seedColor,
  slideThemeReference,
} from './style.ts';
export {
  createDeckSync,
  DECK_SYNC_PROTOCOL,
  type DeckSync,
  type DeckSyncChannel,
  type DeckSyncMessage,
  type DeckSyncOptions,
  type DeckSyncPosition,
  parseDeckSyncMessage,
} from './sync.ts';
export { type DeckSyncLink, type DeckSyncSignal, deckSyncLink } from './sync-link.ts';
export {
  createDeckThemeCache,
  type DeckThemeLoader,
  deckCatalogThemeIds,
  deckThemeVariables,
  loadDeckLibraryTheme,
  resolveDeckThemeMode,
} from './theme.ts';
export {
  DECK_MORPH_ATTRIBUTE,
  type DeckTransitionDirection,
  type DeckTransitionDocument,
  type DeckTransitionMode,
  type DeckViewTransition,
  type PlayDeckTransitionOptions,
  type PlayedDeckTransition,
  playDeckTransition,
  transitionKeyframes,
  viewTransitionIdent,
  viewTransitionPrefix,
} from './transition.ts';
