<script lang="ts">
/**
 * DeckStageCore: the whole stage without a reference to the default renderer
 * tables (G72). `DeckStage` is this component with the defaults source
 * (`defaults`) filled in; a host that brings its own renderers imports
 * `DeckStageCore` from `@texuli/slides/stage-core`, and its build emits none
 * of the default tables' chunks or CSS. Without `defaults` the stage behaves
 * as `defaultRenderers={false}`.
 *
 * DeckStage v2 (ADR-009): the presentation stage on the `@texuli/deck` engine.
 *
 * - Input: any deck (v2, Texuli v1, grammar tree, Protoyard) through
 *   `migrateDeck` + `parseDeck`; an invalid deck shows its diagnostics and is
 *   never painted.
 * - A fixed virtual canvas (1280 × 720 for 16:9, …) scaled into the stage
 *   with a ResizeObserver and letterboxed; at most three slides mounted (the
 *   active one and its neighbours, inert), the next ones prefetched idle.
 * - Navigation through `createDeckController`: keys via `decideDeckInput`
 *   (focus-scoped: only the focused deck reacts, plus page-wide keys for the
 *   deck that owns the URL hash), swipe, click-to-advance with guards,
 *   auto-slide, `#/<slide>/<step>` deep links, plugin hooks around paints.
 * - Transitions rendered with View Transitions (CSS fallback, reduced
 *   motion → short fade, motion `none` → cut); fragments animate per effect.
 * - Style: `resolveDeckStyle` variables and the theme tokens on the stage
 *   root (never `<html>`), backgrounds with a contrast scrim, `lang`/`dir`
 *   from `meta`, every string from overridable messages.
 *
 * Seams: `renderers` (layouts, components, backgrounds), `getDeckStepContext()`
 * for renderers, `getDeckStageContext()` and the `chrome`, `overviewView` and
 * `presenterView` snippets for the chrome lanes.
 */
import type {
  DeckAction,
  DeckActionSource,
  DeckController,
  DeckHashLocation,
  DeckInputState,
  DeckLocation,
  DeckPlugin,
  DeckState,
  DeckStateChange,
  PresenterTransport,
  ResolvedTransition,
} from '@texuli/deck/engine';
import {
  createDeckController,
  deckCanvasSize,
  fitDeckCanvas,
  formatDeckHash,
  resolveDeckLocale,
  resolveDeckTransition,
} from '@texuli/deck/engine';
import type { Deck, DeckSlide } from '@texuli/deck/model';
import { resolveDeckStyle } from '@texuli/deck/model';
import { resolveImageSources } from '@texuli/media/image';
import type { PlayerDesignSystemEvent, PlayerDesignSystems } from '@texuli/player/design-system';
import type { Theme } from '@texuli/tokens/contract';
import { defineTheme } from '@texuli/tokens/contract';
import { flushSync, getContext, onMount, type Snippet, setContext, tick, untrack } from 'svelte';
// A server build preloads the stage's own lazy code (never the default tables) here, so the
// server render keeps the slides (`./ssr-core-server.ts`); a browser build imports nothing.
import '#deck-ssr-core';
import { loadBuiltinDeckBlocks, loadedBuiltinDeckBlocks } from './builtin-loader.ts';
import DeckChrome from './chrome/DeckChrome.svelte';
import DeckProgress from './chrome/DeckProgress.svelte';
import DeckToolbar from './chrome/DeckToolbar.svelte';
import { createDeckChromeState, setDeckChromeContext } from './chrome/state.svelte.ts';
import { type DeckStageContext, type DeckStageSlideEntry, setDeckStageContext } from './context.ts';
import { deckCssVars } from './css-vars.ts';
import DeckError from './DeckError.svelte';
import DeckSlideView from './DeckSlideView.svelte';
import { dispatchDeckEvent } from './events.ts';
import { canUseNativeFullscreen, type DeckFullscreenState } from './fullscreen.ts';
import { whenIdle } from './idle.ts';
import { clickInput, createSwipeTracker, keyInput, selectionLength } from './input.ts';
import { deckInputTitle } from './label.ts';
import type { DeckMediaTrust } from './media.ts';
import { createDeckTranslator, type DeckStageMessages } from './messages.ts';
import { loadDeckMigration, loadedDeckMigration } from './migration.ts';
import { captureFragments, loadStageMotion, stageMotionLevel } from './motion-capture.ts';
import type { SlideNavigationIntent, SlideStepIntent } from './navigation.ts';
import DeckOverview from './overview/DeckOverview.svelte';
import { isDeckV2Input, isPreparedDeck, prepareDeckWith } from './prepare-core.ts';
import DeckPresenterPane from './presenter/DeckPresenterPane.svelte';
import type { DeckPresenterHost } from './presenter/host.ts';
import type { DeckPreviewPaint } from './presenter/paint.ts';
import {
  type DeckDefaultRenderersSource,
  type DeckRenderers,
  deckRendererList,
  deckValidationHooks,
  deckValidatorsReady,
  loadDeckValidators,
  resolveSlideRenderer,
} from './renderers.ts';
import {
  claimDeckHash,
  readDeckHash,
  releaseDeckHash,
  watchDeckHash,
  writeDeckHash,
} from './route.ts';
import {
  deckBackgroundPalette,
  deckThemeId,
  deckThemeKey,
  deckThemeReferences,
  loadDeckTheme,
  resolveStageMode,
  slideThemeReference,
} from './style.ts';
import type { DeckSync } from './sync.ts';
import { deckSyncLink } from './sync-link.ts';
import { type DeckThemeLoader, deckThemeVariables } from './theme.ts';
import {
  type DeckTransitionDirection,
  playDeckTransition,
  transitionKeyframes,
} from './transition.ts';

interface Props {
  /**
   * A v2 deck, or any input `migrateDeck` understands (Texuli v1, grammar
   * tree, Protoyard), or a prepared deck (G83: an `ok` result of
   * `prepareDeck` / `prepareDeckV2`). At the `developer` tier a prepared deck
   * paints without migrating or validating again (no migration, block check
   * or validator chunk loads for it); at the `untrusted` tier its `deck` is
   * validated like any input. A look-alike object is never trusted.
   */
  deck: unknown;
  /**
   * Keep `#/<slide>/<step>` in the URL (replaceState) and follow `hashchange`
   * and deep links. Default true; only the first stage on a page claims the
   * hash, so embedded decks never fight over it.
   */
  syncHash?: boolean;
  /** `container` (default) letterboxes inside the host box; `viewport` fills the window height. */
  fit?: 'viewport' | 'container';
  /** URL policy tier for every link and media source painted. Default `untrusted`. */
  tier?: DeckMediaTrust;
  /** v1 name of `tier` (kept for existing hosts). */
  mediaTrust?: DeckMediaTrust;
  /**
   * Show the stage's "Untrusted content" badge (`stage.untrustedBadge`) in the
   * chrome row when the paint tier is `untrusted`. Default true: components
   * paint through the player with its own chrome off, so the stage carries the
   * trust signal. Never shown at the `developer` tier.
   */
  trustBadge?: boolean;
  /** Partial overrides of the stage messages (English defaults). */
  messages?: DeckStageMessages;
  /** Override `meta.locale` (the `lang` of the stage). */
  locale?: string;
  /** Override `meta.dir`. */
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Engine plugins, in order (`beforeNavigate`, `beforeRender`/`afterRender`, …). */
  plugins?: readonly DeckPlugin[];
  /** Renderer tables, first answer wins (layouts, components, backgrounds, custom slides). */
  renderers?: DeckRenderers | readonly DeckRenderers[];
  /**
   * Append the default renderer tables (the 20 catalog layouts and the
   * component registry) after `renderers`. Default true: the tables are
   * imported on first use, and the first stage shows a loading status until
   * they arrive (`loadDefaultDeckRenderers()` before mounting skips it).
   * `false` leaves every slide to the host's tables (none of the defaults'
   * code is bundled into the stage's initial graph, and nothing of them
   * loads: no lazy chunk, CSS or prefetch), and a slide no table answers
   * shows a placeholder.
   */
  defaultRenderers?: boolean;
  /**
   * Where the default tables come from (`DeckStage` passes the built-in
   * source). `DeckStageCore` without it never loads or references them, as
   * with `defaultRenderers={false}`.
   */
  defaults?: DeckDefaultRenderersSource;
  /** Focus the active slide on mount. */
  autofocus?: boolean;
  /** Instance namespace (presenter channel, view-transition names). Defaults to a unique id. */
  namespace?: string;
  initialSlideId?: string;
  initialStep?: number;
  /** Override `navigation.autoSlideMs` (0 turns auto-slide off). */
  autoSlideMs?: number;
  /** A primary click on the slide advances (links, controls, media and interactive blocks never do). */
  clickToAdvance?: boolean;
  /** Presenter layout (notes and up next beside the canvas). */
  presenter?: boolean;
  /** Show the elapsed timer in the presenter pane. */
  presenterTimer?: boolean;
  /** A same-origin link to another stage window: the presenter protocol, or a v1 `DeckSync`. */
  sync?: PresenterTransport | DeckSync | null;
  /**
   * Catalog theme loader. This core component has no default (G127): without
   * one (or with `null`) catalog themes are left to the host's CSS, and the
   * build has no reference to the token theme library. `DeckStage` defaults
   * to `loadDeckLibraryTheme`; pass it here to load the library on first use.
   */
  loadTheme?: DeckThemeLoader | null;
  /**
   * Resolves a deck's `designSystem.ref` (ADR-024): a document or a compiled
   * design system, sync or async; never a fetch. `mode` picks the compiled
   * mode (default: the stage's, `dark` or `light`).
   */
  designSystems?: PlayerDesignSystems | null;
  /** Called when a deck's design system applies or is refused. */
  onDesignSystem?: (event: PlayerDesignSystemEvent) => void;
  resolveAvatar?: (id: string) => string | undefined;
  /** The engine controller (read-only binding) for imperative hosts. */
  controller?: DeckController | null;
  /** Replaces the default toolbar and progress bar. */
  chrome?: Snippet;
  /**
   * Host controls added to the default toolbar as its last group (G82): they
   * follow the stage's tools in focus order and keep the progress bar. Not
   * rendered when `chrome` replaces the toolbar.
   */
  tools?: Snippet;
  /**
   * Where the toolbar (or the host `chrome` snippet) sits: `bottom` (default)
   * below the slide, aligned to the inline end, or `top` above it.
   */
  toolbarPosition?: 'bottom' | 'top';
  /** Replaces the default overview. */
  overviewView?: Snippet;
  /** Replaces the default presenter pane. */
  presenterView?: Snippet;
  onSlideChange?: (intent: SlideNavigationIntent) => void;
  onStepChange?: (intent: SlideStepIntent) => void;
  onPresenterChange?: (open: boolean) => void;
  onFullscreenChange?: (state: DeckFullscreenState) => void;
  onError?: (issues: PreparedIssues) => void;
}

type PreparedDeck = ReturnType<typeof prepareDeckWith>;
type PreparedIssues = PreparedDeck['issues'];

let {
  deck,
  syncHash = true,
  fit = 'container',
  tier,
  mediaTrust,
  trustBadge = true,
  messages,
  locale,
  dir,
  plugins = [],
  renderers,
  defaultRenderers = true,
  defaults,
  autofocus = false,
  namespace,
  initialSlideId,
  initialStep = 0,
  autoSlideMs,
  clickToAdvance = true,
  presenter = $bindable(false),
  presenterTimer = false,
  sync = null,
  loadTheme,
  designSystems,
  onDesignSystem,
  resolveAvatar,
  controller = $bindable(null),
  chrome,
  tools,
  toolbarPosition = 'bottom',
  overviewView,
  presenterView,
  onSlideChange,
  onStepChange,
  onPresenterChange,
  onFullscreenChange,
  onError,
}: Props = $props();

const uid = $props.id();
const browser = typeof window !== 'undefined';
// svelte-ignore state_referenced_locally
const instance = namespace ?? uid;
// The first stage on a page that asks owns the URL hash (and page-wide keys).
// svelte-ignore state_referenced_locally
const ownsHash = browser && syncHash && claimDeckHash(window, instance);

let paintTier = $derived<DeckMediaTrust>(tier ?? mediaTrust ?? 'untrusted');
// G83: a prepared deck (the brand is `prepareDeck`'s own record, never the object's shape) skips
// migration and validation at the developer tier only; otherwise its deck is validated as input.
let preparedInput = $derived(isPreparedDeck(deck) ? deck : null);
let trustedPrepared = $derived(paintTier === 'developer' ? preparedInput : null);
let input = $derived<unknown>(preparedInput ? preparedInput.deck : deck);

// Host renderers win; the default layouts and component registry answer last (unless turned
// off). They are imported on first use: until they (and any lazy host block check) arrive, the
// stage validates and paints nothing and shows a loading status (also during SSR).
// svelte-ignore state_referenced_locally
let defaultTables = $state.raw<readonly DeckRenderers[] | undefined>(defaults?.loaded());
let validatorsVersion = $state(0);
let useDefaults = $derived(defaultRenderers !== false && defaults !== undefined);
let defaultsReady = $derived(!useDefaults || defaultTables !== undefined);
let rendererList = $derived(
  useDefaults
    ? [...deckRendererList(renderers), ...(defaultTables ?? [])]
    : [...deckRendererList(renderers)]
);
let validatorsReady = $derived.by(() => {
  void validatorsVersion;
  return trustedPrepared !== null || deckValidatorsReady(rendererList);
});
// The built-in block support (the default block check and free-slide renderer, one lazy chunk):
// needed before validating only when no table brings a block check (G46).
let builtin = $state.raw(loadedBuiltinDeckBlocks());
let needsBuiltinCheck = $derived(
  trustedPrepared === null &&
    !rendererList.some(
      (table) =>
        typeof table.validateBlock === 'function' || typeof table.loadValidateBlock === 'function'
    )
);
let builtinReady = $derived(!needsBuiltinCheck || builtin !== undefined);
// `migrateDeck` loads only for a deck in an earlier shape (a v2 deck needs none); `null` = failed.
let migrate = $state.raw<ReturnType<typeof loadedDeckMigration> | null>(loadedDeckMigration());
let needsMigration = $derived(trustedPrepared === null && !isDeckV2Input(input));
let migrationReady = $derived(!needsMigration || migrate !== undefined);
let prepared = $derived.by<PreparedDeck | null>(() => {
  if (!defaultsReady) return null;
  if (trustedPrepared) return trustedPrepared;
  if (!validatorsReady || !builtinReady || !migrationReady) return null;
  const hooks = deckValidationHooks(rendererList);
  const check = hooks.validateBlock ?? builtin?.validateBlock;
  // Unreachable (builtinReady), kept so a missing check never means "accept every block".
  if (!check) return null;
  return prepareDeckWith(input, hooks, check, migrate ?? undefined);
});
let model = $derived(prepared?.ok ? prepared.deck : null);
// The landmark's name: the validated title, else the input's own title while it loads (never a
// shared "Presentation: " name across stages; an untitled loading stage stays unnamed).
let stageTitle = $derived(model ? model.meta.title : deckInputTitle(input));

$effect.pre(() => {
  if (!useDefaults || !defaults || defaultTables !== undefined) return;
  let live = true;
  defaults.load().then(
    (tables) => {
      if (live) defaultTables = tables;
    },
    () => {
      // The chunk failed: paint without the defaults (their slides show placeholders).
      if (live) defaultTables = [];
    }
  );
  return () => {
    live = false;
  };
});

$effect.pre(() => {
  if (migrate !== undefined || !needsMigration) return;
  let live = true;
  void loadDeckMigration().then((loadedMigrate) => {
    if (live) migrate = loadedMigrate;
  });
  return () => {
    live = false;
  };
});

$effect.pre(() => {
  if (builtin !== undefined || !needsBuiltinCheck) return;
  let live = true;
  void loadBuiltinDeckBlocks().then((loadedBlocks) => {
    if (live) builtin = loadedBlocks;
  });
  return () => {
    live = false;
  };
});

$effect.pre(() => {
  if (!defaultsReady || validatorsReady) return;
  let live = true;
  void loadDeckValidators(rendererList).then(() => {
    if (live) validatorsVersion += 1;
  });
  return () => {
    live = false;
  };
});
let t = $derived(createDeckTranslator(messages));
let showTrustBadge = $derived(trustBadge !== false && paintTier === 'untrusted');
let localeInfo = $derived(resolveDeckLocale(model?.meta, { locale, dir }));

function slideExists(current: Deck, id: string): boolean {
  return current.slides.some((slide) => slide.id === id && slide.hidden !== true);
}

function initialLocation(current: Deck): { slideId?: string; step: number } {
  if (ownsHash) {
    const fromHash = readDeckHash(window);
    if (fromHash && slideExists(current, fromHash.slideId)) return fromHash;
  }
  if (initialSlideId && slideExists(current, initialSlideId)) {
    return { slideId: initialSlideId, step: initialStep };
  }
  return { step: 0 };
}

// One engine per validated deck. Auto-slide never runs during SSR.
let engine = $derived.by(() => {
  const current = model;
  if (!current) return null;
  return untrack(() => {
    const start = initialLocation(current);
    return createDeckController(current, {
      ...(start.slideId ? { initialSlideId: start.slideId, initialStep: start.step } : {}),
      plugins,
      autoSlideMs: browser ? autoSlideMs : 0,
    });
  });
});

// The position on screen; it trails the engine while a view transition captures.
let shown = $state.raw<{ engine: DeckController; state: DeckState } | null>(null);
let view = $derived(
  engine ? (shown && shown.engine === engine ? shown.state : engine.getState()) : null
);
let overviewOpen = $state(false);
let overviewFocus = $state(false);
let presenterFocus = $state(false);
let blackout = $state(false);
let stepDirection = $state<'forward' | 'backward' | 'none'>('none');
let enter = $state.raw<{
  slideId: string;
  name: string;
  direction: DeckTransitionDirection;
} | null>(null);
let lastTransition = $state.raw<ResolvedTransition | undefined>(undefined);

let root: HTMLElement | undefined = $state();
let viewport: HTMLElement | undefined = $state();
let canvasElement: HTMLElement | undefined = $state();
let slideElements = $state<Record<string, HTMLElement | undefined>>({});
let fullscreen = $state<DeckFullscreenState>('off');
let fullscreenNote = $state<string | null>(null);
let reducedMotion = $state(false);
let preferenceVersion = $state(0);
let hostMode = $state<string | null>(null);
let mounted = $state(false);
let measured = $state.raw<{ width: number; height: number } | null>(null);
// Loaded themes by reference key; `null` marks one that could not be used.
let themes = $state.raw<Record<string, Theme | null>>({});
const pendingThemes = new Set<string>();

let entries = $derived.by((): DeckStageSlideEntry[] => {
  if (!model) return [];
  let position = 0;
  const out: DeckStageSlideEntry[] = [];
  model.slides.forEach((slide, index) => {
    if (slide.hidden === true) return;
    out.push({ slide, index, position, title: slideTitle(slide, position) });
    position += 1;
  });
  return out;
});
let position = $derived(
  view
    ? Math.max(
        0,
        entries.findIndex((entry) => entry.index === view.slideIndex)
      )
    : 0
);
let activeSlide = $derived<DeckSlide | undefined>(
  model && view ? model.slides[view.slideIndex] : undefined
);
let activeEntry = $derived(entries[position]);
// At most three slides mounted: the previous, the active and the next visible one.
let mountedEntries = $derived(entries.slice(Math.max(0, position - 1), position + 2));

function slideTitle(slide: DeckSlide, at: number): string {
  if (slide.title) return slide.title;
  const props = (slide as { props?: unknown }).props;
  const fromProps =
    props && typeof props === 'object' ? (props as { title?: unknown }).title : undefined;
  if (typeof fromProps === 'string' && fromProps.trim()) return fromProps;
  return t('stage.untitledSlide', { current: at + 1 });
}

// Style: deck style with the active slide's overrides, the reduced-motion preference and host mode.
let activeRef = $derived(model ? slideThemeReference(model, activeSlide) : undefined);
let mode = $derived.by(() => {
  void preferenceVersion;
  const requested = activeRef?.mode ?? 'system';
  if (requested !== 'system') return requested;
  return mounted ? resolveStageMode(activeRef, hostMode) : 'light';
});
let styleResolution = $derived(
  resolveDeckStyle(model?.style, {
    override: activeSlide
      ? {
          ...(activeSlide.transition ? { transition: activeSlide.transition } : {}),
          ...(activeSlide.background ? { background: activeSlide.background } : {}),
        }
      : undefined,
    reducedMotion,
    hostMode: mode,
  })
);
let canvas = $derived(deckCanvasSize(styleResolution.style.aspect));

function themeFor(reference: ReturnType<typeof slideThemeReference>): Theme | null | undefined {
  if (!reference) return undefined;
  if (reference.kind === 'embedded') {
    try {
      return defineTheme(reference.theme);
    } catch {
      return null;
    }
  }
  const key = deckThemeKey(reference);
  return key ? themes[key] : undefined;
}

let activeTheme = $derived(themeFor(activeRef) ?? undefined);
let themeStatus = $derived.by(() => {
  if (!activeRef) return undefined;
  if (activeRef.kind === 'embedded') return activeTheme ? 'applied' : 'unavailable';
  if (activeRef.kind === 'catalog' && !loadTheme) return 'host';
  const key = deckThemeKey(activeRef) ?? '';
  if (!(key in themes)) return 'loading';
  return themes[key] ? 'applied' : 'unavailable';
});

// ── A deck's own design system (ADR-024): loaded lazily, only for a deck that names one ──
type StageSystem = import('./design-system.ts').StageDesignSystem;
type Defaults = Record<string, Record<string, string>>;
let systemReference = $derived(model?.designSystem);
let systemKey = $derived(systemReference ? JSON.stringify(systemReference) : '');
let system = $state.raw<StageSystem | undefined>();
let systemStatus = $state<'pending' | 'applied' | 'refused' | undefined>();
let systemMode = $derived<'light' | 'dark'>(
  designSystems?.mode ?? (mode === 'dark' ? 'dark' : 'light')
);
// Component defaults for every texuli component on the slides (the `texuli/defaults` context),
// merged over an outer provider's prop by prop; props on a block still win.
const DEFAULTS_KEY = 'texuli.design-defaults';
const outerDefaults = getContext<(() => Defaults) | undefined>(DEFAULTS_KEY);
setContext(DEFAULTS_KEY, () => {
  const outer = outerDefaults?.() ?? {};
  const own = system?.defaults;
  if (!own) return outer;
  const merged: Defaults = { ...outer };
  for (const key of Object.keys(own)) merged[key] = { ...outer[key], ...own[key] };
  return merged;
});
$effect(() => {
  const key = systemKey;
  const reference = untrack(() => systemReference);
  const host = untrack(() => designSystems);
  const trust = paintTier === 'developer' ? 'developer' : 'untrusted';
  if (!key || !reference) {
    system = undefined;
    systemStatus = undefined;
    return;
  }
  let live = true;
  systemStatus = 'pending';
  import('./design-system.ts')
    .then((step) => step.loadStageDesignSystem(reference, host, trust, root?.ownerDocument))
    .then(
      ({ event, system: next }) => {
        if (!live) return;
        system = next;
        systemStatus = event.status;
        onDesignSystem?.(event);
      },
      () => {
        if (live) systemStatus = 'refused';
      }
    );
  return () => {
    live = false;
  };
});

function paletteFor(slide: DeckSlide) {
  if (system) return system.palette(systemMode);
  const reference = model ? slideThemeReference(model, slide) : undefined;
  const slideMode = reference?.mode && reference.mode !== 'system' ? reference.mode : mode;
  return deckBackgroundPalette(themeFor(reference) ?? null, slideMode);
}

let logo = $derived(
  styleResolution.style.logo
    ? resolveImageSources({ src: styleResolution.style.logo, trust: paintTier }).src
    : undefined
);
let announcement = $derived.by(() => {
  if (!view || !activeEntry) return '';
  const values = { current: position + 1, total: entries.length, title: activeEntry.title };
  return view.stepCount > 0
    ? t('stage.announceStep', { ...values, step: view.step, steps: view.stepCount })
    : t('stage.announce', values);
});
let fitVars = $derived.by((): Record<string, string> => {
  if (!measured) return {};
  const result = fitDeckCanvas(
    measured.width,
    measured.height,
    styleResolution.style.aspect,
    'contain'
  );
  return {
    '--tx-deck-scale': String(result.scale),
    '--tx-deck-offset-x': `${result.offsetX}px`,
    '--tx-deck-offset-y': `${result.offsetY}px`,
  };
});

// ---------------------------------------------------------------------------
// Navigation and events

// The slide that should take focus once it is on screen. A view transition
// swaps the DOM a frame or more after the engine moved, so focusing at once
// would land on the outgoing slide, which turns inert and drops focus to
// <body>. `undefined`: nothing pending; `null`: focus the stage root.
let pendingFocus: string | null | undefined;

function focusSlide() {
  pendingFocus = engine?.getState().slideId ?? view?.slideId ?? null;
  void tick().then(() => flushFocus(false));
}

/**
 * Focus the pending slide if it is the one shown. `deferred` is the call from
 * a view transition's DOM update: by then the user may have moved on, so it
 * only takes focus back while focus is still in the deck or was dropped to
 * <body> by the swap (never from an embedding page's own controls).
 */
function flushFocus(deferred: boolean) {
  const id = pendingFocus;
  if (id === undefined) return;
  if (id !== null && view?.slideId !== id) return;
  pendingFocus = undefined;
  if (deferred) {
    const active = document.activeElement;
    const dropped = !active || active === document.body || active === document.documentElement;
    if (!dropped && !root?.contains(active)) return;
  }
  const target = (id ? slideElements[id] : undefined) ?? root;
  target?.focus({ preventScroll: true });
}

let focusAfterMove = false;

// Slide transitions still playing, and the latest route (`hashchange`) that
// arrived meanwhile: it is applied once they end, never dropped. `routeEpoch`
// ignores transitions of an engine that has been replaced.
let transitions = 0;
let routeEpoch = 0;
let queuedRoute: DeckHashLocation | null = null;
let flushRoute: (() => void) | null = null;
let followRoute: ((target: DeckHashLocation) => void) | null = null;
// The hash the address bar shows on the stage's behalf: the last one it wrote
// or followed. Any other deck route there is the user's, and is never
// overwritten (its `hashchange` may still be on its way).
let routeHash: string | null = null;

function writeRoute(location: DeckHashLocation) {
  writeDeckHash(window, location);
  routeHash = formatDeckHash(location.slideId, location.step);
}

function visiblePosition(current: DeckState): number {
  return entries.findIndex((entry) => entry.index === current.slideIndex);
}

function reportChange(change: DeckStateChange) {
  const { state: next, previous, source } = change;
  const slide = model?.slides[next.slideIndex];
  if (!slide) return;
  if (next.slideId !== previous.slideId) {
    onSlideChange?.({ index: next.slideIndex, slideId: next.slideId });
    dispatchDeckEvent(root, 'tx-deck:change', { state: next, previous, source });
  } else {
    dispatchDeckEvent(root, 'tx-deck:step', { state: next, previous, source });
  }
  onStepChange?.({
    index: next.slideIndex,
    slideId: next.slideId,
    step: next.step,
    stepCount: next.stepCount,
  });
}

// The motion runtime is its own chunk: warm it once the stage is in the browser.
$effect(() => {
  void loadStageMotion();
});

function onEngineChange(current: DeckController, change: DeckStateChange) {
  const { state: next, previous } = change;
  if (next.slideId === previous.slideId) {
    stepDirection = next.step > previous.step ? 'forward' : 'backward';
    // Fragments change phase through the motion runtime: read them before
    // the step reaches the DOM, animate them after.
    const fragments = mounted ? captureFragments(slideElements[next.slideId]) : null;
    shown = { engine: current, state: next };
    if (fragments?.size) {
      void Promise.all([tick(), loadStageMotion()]).then(([, motion]) =>
        motion?.playFragments(slideElements[next.slideId], fragments, {
          level: stageMotionLevel(styleResolution.motion),
          reducedMotion,
        })
      );
    }
    reportChange(change);
    return;
  }
  const target = model?.slides[next.slideIndex];
  const direction: DeckTransitionDirection =
    visiblePosition(next) >= visiblePosition(previous) ? 'forward' : 'backward';
  const resolved = resolveDeckTransition({
    slide: target,
    style: model?.style,
    reducedMotion,
  });
  lastTransition = resolved;
  const doc = mounted ? document : null;
  const viewTransitions =
    typeof (doc as { startViewTransition?: unknown } | null)?.startViewTransition === 'function';
  const apply = (sync: boolean) => {
    const write = () => {
      shown = { engine: current, state: next };
      stepDirection = 'none';
      enter =
        !viewTransitions && resolved.name !== 'none'
          ? { slideId: next.slideId, name: resolved.name, direction }
          : null;
    };
    if (sync) {
      flushSync(write);
      // Inside the view transition's DOM update: the incoming slide is live now.
      flushFocus(true);
      return;
    }
    write();
    // CSS fallback: the incoming slide enters through the motion runtime.
    if (!mounted || !enter) return;
    const rtl = localeInfo.dir === 'rtl';
    void Promise.all([tick(), loadStageMotion()]).then(([, motion]) =>
      motion?.playSlideEnter(
        slideElements[next.slideId],
        transitionKeyframes(resolved.name, direction, rtl),
        resolved,
        reducedMotion
      )
    );
  };
  const fromId = previous.slideId;
  const played = playDeckTransition({
    resolved,
    direction,
    doc: viewTransitions
      ? (doc as unknown as Parameters<typeof playDeckTransition>[0]['doc'])
      : null,
    namespace: instance,
    rtl: localeInfo.dir === 'rtl',
    reducedMotion,
    update: () => apply(viewTransitions),
    from: () => slideElements[fromId],
    to: () => slideElements[next.slideId],
  });
  const detail = { from: fromId, to: next.slideId, transition: resolved, mode: played.mode };
  dispatchDeckEvent(root, 'tx-deck:transition-start', detail);
  const epoch = routeEpoch;
  transitions += 1;
  void played.finished.then(() => {
    dispatchDeckEvent(root, 'tx-deck:transition-end', detail);
    if (epoch !== routeEpoch) return;
    transitions = Math.max(0, transitions - 1);
    if (transitions === 0) flushRoute?.();
  });
  reportChange(change);
  if (focusAfterMove) {
    focusAfterMove = false;
    focusSlide();
  }
}

function onStageAction(action: DeckAction, source: DeckActionSource) {
  switch (action) {
    case 'overview':
      overviewFocus = source === 'keyboard';
      return;
    case 'fullscreen':
      toggleFullscreen();
      return;
    case 'fullscreen-exit':
      exitFullscreen();
      return;
    case 'presenter':
      presenterFocus = source === 'keyboard';
      setPresenter(!presenter);
      return;
    case 'next':
    case 'prev':
    case 'first':
    case 'last':
    case 'blackout':
      return;
    default:
      // help, laser, copy link, print, jump, debug: the chrome lanes handle these.
      dispatchDeckEvent(root, 'tx-deck:action', { action, source });
  }
}

$effect(() => {
  const current = engine;
  if (!current) return;
  untrack(() => {
    shown = { engine: current, state: current.getState() };
    routeEpoch += 1;
    transitions = 0;
    queuedRoute = null;
    overviewOpen = false;
    blackout = false;
    enter = null;
  });
  const offs = [
    current.subscribe('statechange', (change) => untrack(() => onEngineChange(current, change))),
    current.subscribe('overview', ({ open }) =>
      untrack(() => {
        overviewOpen = open;
        // Slides re-mount when the overview closes: their entrance must not replay.
        enter = null;
        dispatchDeckEvent(root, 'tx-deck:overview', { open });
        if (!open) focusSlide();
      })
    ),
    current.subscribe('blackout', ({ active }) =>
      untrack(() => {
        blackout = active;
        dispatchDeckEvent(root, 'tx-deck:blackout', { active });
      })
    ),
    current.subscribe('action', ({ action, source }) =>
      untrack(() => onStageAction(action, source))
    ),
  ];
  untrack(() => dispatchDeckEvent(root, 'tx-deck:ready', { state: current.getState() }));
  return () => {
    for (const off of offs) off();
    current.destroy();
  };
});

$effect(() => {
  controller = engine;
});

$effect(() => {
  if (!prepared || prepared.ok) return;
  const issues = prepared.issues;
  untrack(() => {
    onError?.(issues);
    dispatchDeckEvent(root, 'tx-deck:error', { issues });
  });
});

// Plugin render hooks around each paint of a new position (a string key, so
// re-reading the same position never repeats them).
let paintKey = $derived(view ? `${view.slideId}:${view.step}` : '');
$effect.pre(() => {
  if (!paintKey) return;
  untrack(() => engine?.beforeRender());
});
$effect(() => {
  if (!paintKey) return;
  untrack(() => engine?.afterRender());
});

// URL hash: write on every position, follow hashchange and deep links.
$effect(() => {
  if (!ownsHash || !view) return;
  const at = { slideId: view.slideId, step: view.step };
  untrack(() => {
    // A route waits for the transition to end: keep the address the user typed until it applies.
    if (queuedRoute) return;
    // The user changed the address since the stage last wrote it (a slide
    // transition can finish before the `hashchange` task runs): follow it, never overwrite it.
    if (routeHash !== null && window.location.hash !== routeHash) {
      const typed = readDeckHash(window);
      if (typed && model && slideExists(model, typed.slideId) && followRoute) {
        followRoute(typed);
        return;
      }
    }
    writeRoute(at);
  });
});
$effect(() => {
  const current = engine;
  const currentDeck = model;
  if (!ownsHash || !current || !currentDeck) return;
  const follow = (target: DeckHashLocation, queued = false) => {
    if (!slideExists(currentDeck, target.slideId)) return;
    const hash = formatDeckHash(target.slideId, target.step);
    // The address bar is back at the stage's own position: nothing to follow,
    // and a route queued meanwhile is no longer wanted.
    if (!queued && hash === routeHash && window.location.hash === routeHash) {
      queuedRoute = null;
      return;
    }
    if (transitions > 0) {
      queuedRoute = target;
      return;
    }
    const now = current.getState();
    if (now.slideId !== target.slideId || now.step !== target.step) {
      const location: DeckLocation = { ...now, slideId: target.slideId, step: target.step };
      current.goTo(location, { source: 'route' });
    }
    routeHash = hash;
    // A step past the slide's last one is clamped (or a plugin redirected the
    // move): the address bar shows where the deck is, also when it did not move.
    const after = current.getState();
    if (after.slideId !== target.slideId || after.step !== target.step) {
      writeRoute({ slideId: after.slideId, step: after.step });
    }
  };
  followRoute = (target) => follow(target);
  flushRoute = () => {
    const target = queuedRoute;
    queuedRoute = null;
    if (target) follow(target, true);
  };
  const stop = watchDeckHash(window, (target) => follow(target));
  return () => {
    stop();
    followRoute = null;
    flushRoute = null;
    queuedRoute = null;
  };
});

// Idle prefetch of the slides after the mounted window.
// Block families load only for free slides the built-in renderer paints (with the built-in chunk).
$effect(() => {
  const ahead = entries.slice(position + 2, position + 4).map((entry) => entry.slide);
  const list = rendererList;
  const lookup = { tier: paintTier };
  if (!mounted || ahead.length === 0) return;
  return whenIdle(window, () => {
    for (const slide of ahead) {
      for (const table of list) {
        try {
          void table.prefetch?.(slide)?.catch(() => {});
        } catch {
          // A failing host prefetch is not the stage's concern.
        }
      }
    }
    const builtinFree = ahead.filter(
      (slide) => slide.layout === 'free' && !resolveSlideRenderer(list, slide, lookup)
    );
    if (builtinFree.length > 0) {
      void loadBuiltinDeckBlocks().then((loadedBlocks) => loadedBlocks.prefetch(builtinFree));
    }
  });
});

// Same-origin link to another stage window (presenter screen).
let remote: string | null = null;
let established = false;
$effect(() => {
  // While the presenter window is open the stage follows it; the host link resumes after.
  const link = deckSyncLink(presenterLink ?? sync);
  const current = engine;
  if (!link || !current) return;
  const off = link.subscribe((signal) =>
    untrack(() => {
      const now = current.getState();
      if (signal.kind === 'hello') {
        if (!presenter || established) link.post(now.slideId, now.step);
        return;
      }
      established = true;
      if (!model || !slideExists(model, signal.slideId)) return;
      if (now.slideId === signal.slideId && now.step === signal.step) return;
      remote = `${signal.slideId}:${signal.step}`;
      current.goTo({ ...now, slideId: signal.slideId, step: signal.step }, { source: 'presenter' });
    })
  );
  const offLocal = current.subscribe('statechange', ({ state: next, source }) => {
    const key = `${next.slideId}:${next.step}`;
    if (source === 'presenter' || key === remote) {
      remote = null;
      return;
    }
    established = true;
    link.post(next.slideId, next.step);
  });
  untrack(() => {
    const now = current.getState();
    link.hello(now.slideId, now.step);
  });
  return () => {
    off();
    offLocal();
  };
});

// ---------------------------------------------------------------------------
// Themes: load every reference the deck names once, so slide changes do not flash.

$effect(() => {
  const current = model;
  const loader = loadTheme ?? null;
  if (!current) return;
  const known = untrack(() => themes);
  for (const reference of deckThemeReferences(current)) {
    if (reference.kind === 'embedded') continue;
    if (reference.kind === 'catalog' && !loader) continue;
    const key = deckThemeKey(reference);
    if (!key || key in known || pendingThemes.has(key)) continue;
    pendingThemes.add(key);
    void loadDeckTheme(reference, loader).then((theme) => {
      pendingThemes.delete(key);
      themes = { ...themes, [key]: theme };
    });
  }
});

// The deck theme's variables, or a deck design system's in their place (one owner, no overlap).
$effect(() => {
  const element = root;
  const theme = activeTheme;
  const applied = system;
  if (!element || (!theme && !applied)) return;
  const vars = applied
    ? applied.vars(systemMode)
    : deckThemeVariables(theme as Theme, mode, { reducedMotion });
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
  return () => {
    for (const name of Object.keys(vars)) element.style.removeProperty(name);
  };
});

// ---------------------------------------------------------------------------
// Input

// The chrome's layers (help, laser, slide list); help and laser join the Escape order.
const chromeState = setDeckChromeContext(createDeckChromeState());

function inputState(): DeckInputState {
  return {
    overview: overviewOpen ? 'open' : 'closed',
    blackout,
    help: chromeState.help,
    laser: chromeState.laser,
    fullscreen: fullscreen !== 'off',
    dir: localeInfo.dir,
  };
}

function onKeydown(event: KeyboardEvent) {
  const current = engine;
  if (!current || event.defaultPrevented) return;
  const target = event.target;
  const inCanvas = target instanceof Node && Boolean(viewport?.contains(target));
  const inRoot = target === root;
  focusAfterMove = inCanvas || inRoot;
  const action = current.handleInput(keyInput(event, root), inputState(), 'keyboard');
  if (!action) {
    focusAfterMove = false;
    return;
  }
  if (action !== 'print') event.preventDefault();
}

// The deck that owns the URL also takes keys while nothing else has focus.
function onWindowKeydown(event: KeyboardEvent) {
  if (!ownsHash) return;
  const active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement) return;
  onKeydown(event);
}

let focusedAtPointerDown = false;
const swipe = createSwipeTracker();

function onCanvasPointerDown(event: PointerEvent) {
  const active = document.activeElement;
  focusedAtPointerDown = Boolean(active && root?.contains(active));
  if (event.pointerType !== 'mouse') swipe.down(event, canvasElement);
}

function onCanvasPointerUp(event: PointerEvent) {
  const input = swipe.up(event);
  if (input) engine?.handleInput(input, inputState(), 'swipe');
}

function onCanvasClick(event: MouseEvent) {
  const current = engine;
  if (!current || !clickToAdvance) return;
  // The first click on an embedded deck only focuses it.
  if (!focusedAtPointerDown && !ownsHash) {
    focusSlide();
    return;
  }
  current.handleInput(
    clickInput(event, canvasElement, selectionLength(window)),
    inputState(),
    'pointer'
  );
}

// ---------------------------------------------------------------------------
// Presenter and fullscreen

function setPresenter(open: boolean) {
  if (open === presenter) return;
  presenter = open;
  onPresenterChange?.(open);
  dispatchDeckEvent(root, 'tx-deck:presenter', { open });
}

function setFullscreen(next: DeckFullscreenState, note: string | null = null) {
  fullscreen = next;
  fullscreenNote = note;
  onFullscreenChange?.(next);
  dispatchDeckEvent(root, 'tx-deck:fullscreen', { state: next });
}

async function enterFullscreen() {
  const element = root;
  if (!element || fullscreen !== 'off') return;
  let refused = false;
  if (canUseNativeFullscreen(element, document)) {
    try {
      await element.requestFullscreen();
      setFullscreen('native');
      focusSlide();
      return;
    } catch {
      refused = true;
    }
  }
  setFullscreen('viewport', t(refused ? 'stage.fullscreenRefused' : 'stage.fullscreenFallback'));
  focusSlide();
}

function exitFullscreen() {
  if (fullscreen === 'off') return;
  if (fullscreen === 'native' && document.fullscreenElement) {
    void document.exitFullscreen?.().catch(() => undefined);
  }
  setFullscreen('off');
  focusSlide();
}

function toggleFullscreen() {
  if (fullscreen === 'off') void enterFullscreen();
  else exitFullscreen();
}

// In the window-filling fallback, focus that leaves the stage returns to the slide.
function onFocusOut(event: FocusEvent) {
  if (fullscreen !== 'viewport') return;
  const next = event.relatedTarget;
  if (next instanceof Node && !root?.contains(next)) focusSlide();
}

// ---------------------------------------------------------------------------
// Overview thumbnails and presenter previews paint with the stage's own tables.

const previewPaint: DeckPreviewPaint = {
  get deck() {
    return model as Deck;
  },
  get renderers() {
    return rendererList;
  },
  get tier() {
    return paintTier;
  },
  get t() {
    return t;
  },
  get canvas() {
    return canvas;
  },
  get resolveAvatar() {
    return resolveAvatar;
  },
  palette: (slide) => paletteFor(slide),
};
// The presenter window (a second screen, opened from the split view): the
// stage follows its link while it is open, and closes it when the stage goes.
let presenterLink = $state.raw<PresenterTransport | null>(null);
let closePresenterWindow: (() => void) | null = null;
const presenterHost: DeckPresenterHost = {
  attach(link, close) {
    presenterLink = link;
    closePresenterWindow = close;
  },
  detach() {
    presenterLink = null;
    closePresenterWindow = null;
  },
};
$effect(() => () => closePresenterWindow?.());

// ---------------------------------------------------------------------------
// Context for the chrome lanes

setDeckStageContext({
  get deck() {
    return model as Deck;
  },
  get controller() {
    return engine as DeckController;
  },
  get state() {
    return { ...(view as DeckState), overview: overviewOpen, blackout };
  },
  get slide() {
    return activeSlide as DeckSlide;
  },
  get slides() {
    return entries;
  },
  get position() {
    return position;
  },
  get t() {
    return t;
  },
  get tier() {
    return paintTier;
  },
  get style() {
    return styleResolution.style;
  },
  get progress() {
    return styleResolution.style.progress;
  },
  get locale() {
    return localeInfo.locale;
  },
  get dir() {
    return localeInfo.dir;
  },
  get reducedMotion() {
    return reducedMotion;
  },
  get transition() {
    return lastTransition;
  },
  get presenter() {
    return presenter;
  },
  get fullscreen() {
    return fullscreen;
  },
  get namespace() {
    return instance;
  },
  next: () => engine?.next({ source: 'pointer' }),
  prev: () => engine?.prev({ source: 'pointer' }),
  goTo: (slideId, step = 0) => {
    const current = engine;
    if (!current) return;
    current.goTo({ ...current.getState(), slideId, step }, { source: 'pointer' });
  },
  setPresenter,
  toggleFullscreen,
  focusSlide,
} satisfies DeckStageContext);

onMount(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colorPreference = window.matchMedia('(prefers-color-scheme: dark)');
  const contrastPreference = window.matchMedia('(prefers-contrast: more)');
  const html = document.documentElement;
  const updateMotion = () => {
    reducedMotion = motionPreference.matches || html.dataset.txMotion === 'reduce';
  };
  const updateColor = () => {
    hostMode = root?.parentElement?.closest('[data-tx-mode]')?.getAttribute('data-tx-mode') ?? null;
    preferenceVersion += 1;
  };
  updateMotion();
  updateColor();
  mounted = true;
  motionPreference.addEventListener('change', updateMotion);
  colorPreference.addEventListener('change', updateColor);
  contrastPreference.addEventListener('change', updateColor);
  const htmlObserver = new MutationObserver(() => {
    updateMotion();
    updateColor();
  });
  htmlObserver.observe(html, {
    attributes: true,
    attributeFilter: ['data-tx-motion', 'data-tx-mode'],
  });

  // Canvas fit: measure the viewport box and letterbox the virtual canvas in it.
  const measure = () => {
    const box = viewport?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) measured = { width: box.width, height: box.height };
  };
  // The effect below observes the viewport; without ResizeObserver, follow window resizes.
  if (typeof ResizeObserver !== 'function') window.addEventListener('resize', measure);
  measure();

  // Auto-slide pauses while the tab is hidden.
  let pausedByVisibility = false;
  const onVisibility = () => {
    const current = engine;
    if (!current) return;
    if (document.visibilityState === 'hidden' && !current.getState().paused) {
      current.pause();
      pausedByVisibility = true;
    } else if (document.visibilityState === 'visible' && pausedByVisibility) {
      pausedByVisibility = false;
      current.resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('keydown', onWindowKeydown);
  const onFullscreenExit = () => {
    if (fullscreen === 'native' && document.fullscreenElement !== root) setFullscreen('off');
  };
  document.addEventListener('fullscreenchange', onFullscreenExit);
  if (autofocus) focusSlide();

  return () => {
    document.removeEventListener('fullscreenchange', onFullscreenExit);
    if (fullscreen === 'native' && document.fullscreenElement === root) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
    window.removeEventListener('keydown', onWindowKeydown);
    window.removeEventListener('resize', measure);
    document.removeEventListener('visibilitychange', onVisibility);
    htmlObserver.disconnect();
    motionPreference.removeEventListener('change', updateMotion);
    colorPreference.removeEventListener('change', updateColor);
    contrastPreference.removeEventListener('change', updateColor);
    if (ownsHash) releaseDeckHash(window, instance);
  };
});

// The viewport element can be replaced (overview, presenter); observe the current one.
$effect(() => {
  const element = viewport;
  if (!element || typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver((records) => {
    const rect = records[records.length - 1]?.contentRect;
    if (rect && rect.width > 0 && rect.height > 0) {
      measured = { width: rect.width, height: rect.height };
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
});
</script>

{#snippet controls()}
  {#if chrome}
    {@render chrome()}
  {:else}
    <DeckToolbar {tools} />
  {/if}
{/snippet}

{#snippet toolbarRow()}
  {#if showTrustBadge}
    <!-- The trust signal sits at the inline start of the chrome row: plain text, not focusable. -->
    <div class="tx-deck-stage__chrome-row" data-tx-deck-chrome>
      <span class="tx-deck-stage__trust" data-tx-deck-trust="untrusted">{t('stage.untrustedBadge')}</span>
      {@render controls()}
    </div>
  {:else}
    {@render controls()}
  {/if}
  {#if fullscreenNote}
    <p class="tx-deck-stage__fullscreen-note" role="status">{fullscreenNote}</p>
  {/if}
{/snippet}

<!-- Keys from anything focused inside the stage reach decideDeckInput (focus-scoped decks). -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={root}
  class="tx-deck-stage"
  role="region"
  aria-label={stageTitle === undefined ? undefined : t('stage.label', { title: stageTitle })}
  lang={localeInfo.locale}
  dir={localeInfo.dir}
  data-tx-deck={instance}
  data-tx-deck-fit-mode={fit}
  data-tx-deck-motion={styleResolution.motion}
  data-tx-deck-aspect={styleResolution.style.aspect}
  data-tx-deck-toolbar={toolbarPosition === 'top' ? 'top' : 'bottom'}
  {...system?.attrs}
  data-tx-scope={system ? '' : undefined}
  data-tx-deck-design-system={systemStatus}
  data-tx-theme={deckThemeId(activeRef)}
  data-tx-mode={system ? systemMode : activeTheme || activeRef ? mode : undefined}
  data-tx-surface={system ? system.attrs['data-tx-surface'] : activeTheme?.style.surface}
  data-tx-motion={activeTheme ? (reducedMotion ? 'reduce' : 'full') : undefined}
  data-motion={reducedMotion ? 'reduce' : undefined}
  data-theme-status={themeStatus}
  data-presenter={presenter ? 'true' : undefined}
  data-fullscreen={fullscreen === 'off' ? undefined : fullscreen}
  data-tx-deck-invalid={!prepared || prepared.ok ? undefined : 'true'}
  aria-busy={prepared ? undefined : 'true'}
  tabindex="-1"
  onkeydown={onKeydown}
  onfocusout={onFocusOut}
  use:deckCssVars={styleResolution.cssVars}
>
  {#if systemStatus === 'refused'}
    <p class="tx-deck-stage__fullscreen-note" role="status" data-tx-deck-design-system-notice>
      {t('stage.designSystemRefused')}
    </p>
  {/if}
  {#if !prepared}
    <p class="tx-deck-stage__loading" role="status">{t('layout.contentLoading')}</p>
  {:else if !prepared.ok}
    <DeckError issues={prepared.issues} {t} />
  {:else if model && view && activeSlide}
    <!-- DOM order is focus order: below the slide (default), Tab reaches the controls after the slide content. -->
    {#if toolbarPosition === 'top'}
      {@render toolbarRow()}
    {/if}
    <div class="tx-deck-stage__main">
      {#if overviewOpen}
        {#if overviewView}
          {@render overviewView()}
        {:else}
          <DeckOverview focusCurrent={overviewFocus} paint={previewPaint} />
        {/if}
      {:else}
        <div
          bind:this={viewport}
          class="tx-deck-stage__viewport"
          data-tx-deck-fit={measured ? 'ready' : 'pending'}
          use:deckCssVars={fitVars}
        >
          {#if !chrome && styleResolution.style.progress === 'top'}
            <DeckProgress />
          {/if}
          <!-- Pointer input on the canvas goes through decideDeckInput (keyboard users have the key map). -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
          <div
            bind:this={canvasElement}
            class="tx-deck-stage__canvas"
            data-tx-deck-canvas
            data-width={canvas.width}
            data-height={canvas.height}
            onclick={onCanvasClick}
            onpointerdown={onCanvasPointerDown}
            onpointerup={onCanvasPointerUp}
            onpointercancel={() => swipe.cancel()}
          >
            {#each mountedEntries as entry (entry.slide.id)}
              {@const active = entry.index === view.slideIndex}
              <DeckSlideView
                deck={model}
                slide={entry.slide}
                index={entry.index}
                {active}
                step={active ? view.step : entry.position < position ? Number.MAX_SAFE_INTEGER : 0}
                direction={active ? stepDirection : 'none'}
                title={entry.title}
                tier={paintTier}
                {t}
                renderers={rendererList}
                palette={paletteFor(entry.slide)}
                {canvas}
                {resolveAvatar}
                enter={active && enter?.slideId === entry.slide.id ? enter.name : undefined}
                enterDirection={enter?.direction}
                bind:element={slideElements[entry.slide.id]}
              />
            {/each}
            {#if styleResolution.style.footer || logo || styleResolution.style.slideNumbers}
              <div class="tx-deck-stage__footer" data-tx-deck-chrome>
                {#if logo}
                  <img class="tx-deck-stage__logo" src={logo} alt="" decoding="async" />
                {/if}
                {#if styleResolution.style.footer}
                  <span class="tx-deck-stage__footer-text">{styleResolution.style.footer}</span>
                {/if}
                {#if styleResolution.style.slideNumbers}
                  <span class="tx-deck-stage__slide-number" aria-hidden="true">{position + 1}</span>
                {/if}
              </div>
            {/if}
          </div>
          {#if !chrome && styleResolution.style.progress === 'bottom'}
            <DeckProgress />
          {/if}
        </div>
      {/if}
      {#if presenter}
        {#if presenterView}
          {@render presenterView()}
        {:else}
          <DeckPresenterPane
            timer={presenterTimer}
            paint={previewPaint}
            host={presenterHost}
            focusNotes={presenterFocus}
          />
        {/if}
      {/if}
    </div>
    {#if toolbarPosition !== 'top'}
      {@render toolbarRow()}
    {/if}
    <!-- Blackout, laser, help, first-visit hint, full screen overlay, toast: also under a host `chrome`. -->
    <DeckChrome />
    <p class="tx-deck-stage__live" aria-live="polite" aria-atomic="true">{announcement}</p>
  {/if}
</div>
