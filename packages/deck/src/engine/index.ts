/**
 * `@texuli/deck/engine` — framework-free presentation runtime (ADR-009).
 *
 * ## Public API
 *
 * ### Navigation (`navigation.ts`)
 * - `createDeckNavigator(deck, options?)` → `DeckNavigator`
 *   - `next` / `prev` / `first` / `last` / `goTo(id | visibleIndex | location, step?)`
 *   - `goToVertical(sectionId, verticalIndex, step?)`
 *   - `getLocation()` → `DeckLocation` (`slideIndex`, `slideId`, `step`,
 *     `stepCount` = max step index / advances, optional `sectionId` /
 *     `verticalIndex` for stacked outline sections)
 *   - `visibleSlides()`, `stepCountFor(slideId)`
 * - `modelSlideStepCount(slide)` — default advance count from blocks/props/labels
 * - Types: `EngineDeck`, `EngineSlide`, `EngineSection`, `DeckLocation`,
 *   `NavigatorOptions`, `DeckNavigator`
 *
 * ### Hash routing (`hash.ts`)
 * - `parseDeckHash(raw)` / `formatDeckHash(slideId, step)` — `#/<id>/<step>`
 *   Rejects traversal (`..`), uppercase ids, percent-encoding, `?`/`#`/`\` inside.
 * - `parseDeckRoute(hash, search?)` / `formatDeckRoute(location, flags?)` —
 *   `?print=1&notes=1` flags
 * - Constants: `DECK_HASH_ID_MAX` (64), `DECK_HASH_STEP_MAX` (32)
 *
 * ### Controls + input (`controls.ts`)
 * - `DECK_CONTROLS` registry (single source for help/toolbar/docs)
 * - `decideDeckInput(event, state?)` → `DeckAction | null`
 *   Keys: →↓PageDown Space Enter / ←↑PageUp Shift+Space Backspace, Home/End,
 *   O, F, S|P, B|., L, ?, Ctrl/⌘+P, D, Esc stack (debug→help→overview→
 *   blackout→laser→fullscreen-exit). Swipe ≥50 px, 1.5× dominance, <800 ms.
 *   Guards: fields/IME/modifiers/interactive targets/`data-tx-deck-*`.
 * - `inputPathFrom(nodes, stopAt?)`, `deckControlFor`, `availableDeckControls`,
 *   `deckKeyBindings`, `DECK_KEY_BINDINGS`, `DECK_ESCAPE_ORDER`
 * - Swipe constants, `DECK_INTERACTIVE_ATTRIBUTE`, `DECK_CHROME_ATTRIBUTE`
 *
 * ### Canvas fit (`canvas.ts`)
 * - `DECK_CANVAS` / `deckCanvasSize(aspect)` / `fitDeckCanvas(w, h, aspect?, fit?)`
 *   Aspects 16:9, 4:3, 9:16, 1:1. Fit: `contain` | `cover` | `container`
 *   (`container` ≡ letterboxed contain for embedded decks).
 *
 * ### Motion (`motion.ts`)
 * - `resolveDeckTransition({ slide, style, motion, reducedMotion })`
 * - `effectiveMotion`, `morphPairsFor`, `TRANSITION_MS`, `MAX_MOTION_MS`
 *
 * ### Auto-slide (`auto-slide.ts`)
 * - `createAutoSlideScheduler({ intervalMs, onAdvance, clock?, startPaused? })`
 *   Injectable clock; `input()` pauses; clamp 1s…600s.
 *
 * ### Presenter protocol v1 (`presenter.ts`)
 * - Closed messages `{ type: 'hello'|'sync'|'request', slideId, step }`
 * - Namespace `texuli-deck-presenter/1:<ns>` via `presenterChannelName`
 * - `parsePresenterMessage` / `presenterMessage` / `isPresenterMessage`
 * - Transports (no globals at import): `createPresenterTransport(channel)`,
 *   `createMemoryPresenterTransport(ns?)`,
 *   `createBroadcastPresenterTransport(ns, factory?)`
 *
 * ### Controller (`controller.ts`)
 * - `createDeckController(deck, options?)` → `DeckController`
 *   - Navigation: `goTo` / `next` / `prev` / `first` / `last` / `getState`
 *   - `subscribe(listener)` or `subscribe(event, listener)` —
 *     events: `slidechange` | `stepchange` | `statechange` | `overview` |
 *     `blackout` | `pause` | `action` | `destroy`
 *   - `setOverview` / `setBlackout` / `pause` / `resume` / `handleInput` /
 *     `destroy`
 *   - Plugins (ordered): `setup`, `beforeNavigate`, `afterNavigate`,
 *     `beforeRender` (read-only slide/context), `afterRender`, `onAction`,
 *     `onDestroy`. Stage calls `controller.beforeRender()` / `afterRender()`
 *     around a paint; hooks observe only (no HTML injection).
 *
 * ### Messages (`messages.ts`)
 * - `DECK_MESSAGES` English defaults; `formatMessage(key, values?, overrides?)`
 * - `resolveDeckLocale(deck?, override?)` → `{ locale, dir }`
 *
 * ## Constraints
 * - Framework-free and DOM-free at import (no `window`/`document` access).
 * - Imports stay inside `packages/deck/src/` (the engine uses the package's own model;
 *   import-guard enforced), and nothing touches window, document or navigator at load.
 * - Zero third-party runtime dependencies; erasable TypeScript only.
 */

export {
  type AutoSlideOptions,
  type AutoSlideScheduler,
  createAutoSlideScheduler,
  type SchedulerClock,
} from './auto-slide.ts';
export {
  type CanvasFit,
  DECK_ASPECTS,
  DECK_CANVAS,
  DEFAULT_DECK_ASPECT,
  type DeckAspect,
  type DeckCanvasSize,
  type DeckFitMode,
  deckCanvasSize,
  fitDeckCanvas,
  isDeckAspect,
} from './canvas.ts';
export {
  type BeforeNavigateResult,
  createDeckController,
  type DeckActionSource,
  type DeckController,
  type DeckControllerOptions,
  type DeckEventMap,
  type DeckEventName,
  type DeckListener,
  type DeckPlugin,
  type DeckRenderContext,
  type DeckState,
  type DeckStateChange,
} from './controller.ts';
export {
  availableDeckControls,
  DECK_CHROME_ATTRIBUTE,
  DECK_CONTROL_CAPABILITIES,
  DECK_CONTROL_GROUPS,
  DECK_CONTROLS,
  DECK_ESCAPE_ORDER,
  DECK_INPUT_ACTIONS,
  DECK_INTERACTIVE_ATTRIBUTE,
  DECK_KEY_BINDINGS,
  DECK_SWIPE_AXIS_RATIO,
  DECK_SWIPE_MAX_DURATION_MS,
  DECK_SWIPE_MIN_DISTANCE,
  DEFAULT_DECK_CONTROL_ENVIRONMENT,
  type DeckAction,
  type DeckControl,
  type DeckControlCapability,
  type DeckControlEnvironment,
  type DeckControlGroup,
  type DeckControlKey,
  type DeckInputAction,
  type DeckInputEvent,
  type DeckInputState,
  type DeckInputTarget,
  type DeckKeyBinding,
  decideDeckInput,
  deckControlFor,
  deckKeyBindings,
  inputPathFrom,
} from './controls.ts';
export {
  DECK_HASH_ID_MAX,
  DECK_HASH_STEP_MAX,
  type DeckHashLocation,
  type DeckRouteFlags,
  formatDeckHash,
  formatDeckRoute,
  type ParsedDeckRoute,
  parseDeckHash,
  parseDeckRoute,
} from './hash.ts';
export {
  DECK_MESSAGES,
  type DeckLocale,
  type DeckMessageKey,
  type DeckMessages,
  formatMessage,
  type MessageValues,
  resolveDeckLocale,
} from './messages.ts';
export {
  DECK_TRANSITIONS,
  DEFAULT_MOTION,
  DEFAULT_TRANSITION,
  type DeckMotion,
  type DeckTransition,
  effectiveMotion,
  isDeckTransition,
  isMotionLevel,
  MAX_MOTION_MS,
  MOTION_LEVELS,
  type MorphPair,
  morphPairsFor,
  REDUCED_FADE_MS,
  type ResolvedTransition,
  type ResolveTransitionInput,
  resolveDeckTransition,
  SUBTLE_SCALE,
  TRANSITION_MS,
  type TransitionReason,
} from './motion.ts';
export {
  createDeckNavigator,
  type DeckLocation,
  type DeckNavigator,
  type EngineDeck,
  type EngineSection,
  type EngineSlide,
  modelSlideStepCount,
  type NavigatorOptions,
} from './navigation.ts';
export {
  createBroadcastPresenterTransport,
  createMemoryPresenterTransport,
  createPresenterTransport,
  isPresenterMessage,
  PRESENTER_MESSAGE_TYPES,
  PRESENTER_PROTOCOL_PREFIX,
  PRESENTER_PROTOCOL_VERSION,
  type PresenterChannelLike,
  type PresenterMessage,
  type PresenterMessageType,
  type PresenterTransport,
  parsePresenterMessage,
  presenterChannelName,
  presenterMessage,
  sanitizePresenterNamespace,
} from './presenter.ts';
