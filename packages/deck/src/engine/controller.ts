/**
 * Imperative framework-free controller with typed events and ordered plugin hooks.
 *
 * `createDeckController(deck, options)` owns navigation, overview/blackout/pause
 * flags, optional auto-slide, and routes `handleInput` through `decideDeckInput`.
 * Stage chrome (help, laser, fullscreen, presenter window) stays with the host:
 * the controller emits the action and leaves rendering to the stage.
 */

import { createAutoSlideScheduler, type SchedulerClock } from './auto-slide.ts';
import {
  type DeckAction,
  type DeckInputEvent,
  type DeckInputState,
  decideDeckInput,
} from './controls.ts';
import {
  createDeckNavigator,
  type DeckLocation,
  type EngineDeck,
  type EngineSlide,
  type NavigatorOptions,
} from './navigation.ts';

export interface DeckState extends DeckLocation {
  overview: boolean;
  blackout: boolean;
  paused: boolean;
}

export type DeckActionSource =
  | 'api'
  | 'keyboard'
  | 'pointer'
  | 'swipe'
  | 'auto'
  | 'presenter'
  | 'route';

export interface DeckStateChange {
  state: DeckState;
  previous: DeckState;
  source: DeckActionSource;
}

/** Read-only context the stage passes around a paint (plugins may observe only). */
export interface DeckRenderContext {
  state: DeckState;
  /** The slide at `state.slideIndex`, when the deck still has it. */
  slide?: EngineSlide;
  source?: DeckActionSource;
}

export type DeckEventMap = {
  slidechange: DeckStateChange;
  stepchange: DeckStateChange;
  statechange: DeckStateChange;
  overview: { open: boolean; state: DeckState };
  blackout: { active: boolean; state: DeckState };
  pause: { paused: boolean; state: DeckState };
  action: { action: DeckAction; source: DeckActionSource };
  destroy: { state: DeckState };
};

export type DeckEventName = keyof DeckEventMap;
export type DeckListener<K extends DeckEventName> = (detail: DeckEventMap[K]) => void;

/** Plugin beforeNavigate result: cancel, redirect, or continue (void/undefined). */
export type BeforeNavigateResult = boolean | DeckLocation | undefined;

export interface DeckPlugin {
  name: string;
  /** Called once after the controller is built; may return a cleanup. */
  setup?(controller: DeckController): undefined | (() => void);
  /**
   * Return `false` to cancel, a location to redirect, or void to continue.
   * Plugins run in registration order.
   */
  beforeNavigate?(
    target: string | number | DeckLocation,
    current: DeckState
  ): // Plugins may return bare void to continue.
  // biome-ignore lint/suspicious/noConfusingVoidType: bare void = continue
  BeforeNavigateResult | void;
  afterNavigate?(state: DeckState, previous: DeckState): void;
  /**
   * Called by the stage immediately before a paint. Read-only: plugins must
   * not inject HTML or mutate the model. Runs in registration order.
   */
  beforeRender?(context: DeckRenderContext): void;
  /**
   * Called by the stage immediately after a paint. Runs in registration order.
   */
  afterRender?(context: DeckRenderContext): void;
  onAction?(action: DeckAction, source: DeckActionSource): void;
  onDestroy?(): void;
}

export interface DeckControllerOptions extends NavigatorOptions {
  plugins?: readonly DeckPlugin[];
  /** Override deck.navigation.autoSlideMs; 0 or omitted disables. */
  autoSlideMs?: number;
  clock?: SchedulerClock;
  /** Start the auto-slide scheduler paused. */
  autoSlidePaused?: boolean;
}

export interface DeckController {
  goTo(target: string | number | DeckLocation, options?: { source?: DeckActionSource }): DeckState;
  next(options?: { source?: DeckActionSource }): DeckState;
  prev(options?: { source?: DeckActionSource }): DeckState;
  first(options?: { source?: DeckActionSource }): DeckState;
  last(options?: { source?: DeckActionSource }): DeckState;
  getState(): DeckState;
  subscribe(listener: (state: DeckState, previous: DeckState) => void): () => void;
  subscribe<K extends DeckEventName>(event: K, listener: DeckListener<K>): () => void;
  setOverview(open: boolean): void;
  setBlackout(active: boolean): void;
  pause(): void;
  resume(): void;
  handleInput(
    event: DeckInputEvent,
    state?: DeckInputState,
    source?: DeckActionSource
  ): DeckAction | null;
  /**
   * Stage calls this immediately before painting. Invokes each plugin's
   * `beforeRender` in registration order with a read-only context.
   */
  beforeRender(context?: Partial<Omit<DeckRenderContext, 'state'>>): void;
  /**
   * Stage calls this immediately after painting. Invokes each plugin's
   * `afterRender` in registration order.
   */
  afterRender(context?: Partial<Omit<DeckRenderContext, 'state'>>): void;
  destroy(): void;
}

function sameLocation(a: DeckState, b: DeckState): boolean {
  return (
    a.slideId === b.slideId &&
    a.slideIndex === b.slideIndex &&
    a.step === b.step &&
    a.overview === b.overview &&
    a.blackout === b.blackout &&
    a.paused === b.paused
  );
}

export function createDeckController(
  deck: EngineDeck,
  options: DeckControllerOptions = {}
): DeckController {
  const navigator = createDeckNavigator(deck, options);
  let overview = false;
  let blackout = false;
  let paused = false;
  let destroyed = false;

  const listeners = new Map<DeckEventName, Set<(detail: never) => void>>();
  const stateListeners = new Set<(state: DeckState, previous: DeckState) => void>();
  const cleanups: Array<() => void> = [];
  const plugins = options.plugins ?? [];

  const snapshot = (): DeckState => ({
    ...navigator.getLocation(),
    overview,
    blackout,
    paused,
  });

  const emit = <K extends DeckEventName>(event: K, detail: DeckEventMap[K]): void => {
    for (const listener of listeners.get(event) ?? []) {
      (listener as DeckListener<K>)(detail);
    }
  };

  const announceChange = (previous: DeckState, source: DeckActionSource): DeckState => {
    const state = snapshot();
    if (sameLocation(state, previous)) return state;
    const change: DeckStateChange = { state, previous, source };
    emit('statechange', change);
    for (const listener of stateListeners) listener(state, previous);
    if (state.slideId !== previous.slideId || state.slideIndex !== previous.slideIndex) {
      emit('slidechange', change);
    } else if (state.step !== previous.step) {
      emit('stepchange', change);
    }
    for (const plugin of plugins) plugin.afterNavigate?.(state, previous);
    return state;
  };

  const controller = {} as DeckController;

  let navigate: (
    move: () => DeckLocation,
    source?: DeckActionSource,
    target?: string | number | DeckLocation
  ) => DeckState;

  const autoMs = options.autoSlideMs ?? deck.navigation?.autoSlideMs ?? 0;
  const scheduler =
    autoMs > 0
      ? createAutoSlideScheduler({
          intervalMs: autoMs,
          clock: options.clock,
          startPaused: options.autoSlidePaused === true || paused,
          onAdvance: () => {
            if (!paused && !destroyed) navigate(() => navigator.next(), 'auto');
          },
        })
      : undefined;

  navigate = (
    move: () => DeckLocation,
    source: DeckActionSource = 'api',
    target?: string | number | DeckLocation
  ): DeckState => {
    if (destroyed) return snapshot();
    const previous = snapshot();
    let action = move;
    for (const plugin of plugins) {
      const decision = plugin.beforeNavigate?.(target ?? previous, previous);
      if (decision === false) return previous;
      if (decision && typeof decision === 'object') {
        const redirected = decision;
        action = () => navigator.goTo(redirected);
      }
    }
    action();
    return announceChange(previous, source);
  };

  const fireAction = (name: DeckAction, source: DeckActionSource): void => {
    for (const plugin of plugins) plugin.onAction?.(name, source);
    emit('action', { action: name, source });
  };

  const applyAction = (name: DeckAction, source: DeckActionSource): void => {
    fireAction(name, source);
    switch (name) {
      case 'next':
        navigate(() => navigator.next(), source);
        break;
      case 'prev':
        navigate(() => navigator.prev(), source);
        break;
      case 'first':
        navigate(() => navigator.first(), source);
        break;
      case 'last':
        navigate(() => navigator.last(), source);
        break;
      case 'overview':
        controller.setOverview(!overview);
        break;
      case 'blackout':
        controller.setBlackout(!blackout);
        break;
      default:
        // Stage-owned chrome: help, laser, fullscreen, presenter, print, …
        break;
    }
  };

  Object.assign(controller, {
    goTo(target: string | number | DeckLocation, opts: { source?: DeckActionSource } = {}) {
      return navigate(() => navigator.goTo(target), opts.source ?? 'api', target);
    },
    next(opts: { source?: DeckActionSource } = {}) {
      return navigate(() => navigator.next(), opts.source ?? 'api');
    },
    prev(opts: { source?: DeckActionSource } = {}) {
      return navigate(() => navigator.prev(), opts.source ?? 'api');
    },
    first(opts: { source?: DeckActionSource } = {}) {
      return navigate(() => navigator.first(), opts.source ?? 'api');
    },
    last(opts: { source?: DeckActionSource } = {}) {
      return navigate(() => navigator.last(), opts.source ?? 'api');
    },
    getState: snapshot,
    subscribe(
      eventOrListener: DeckEventName | ((state: DeckState, previous: DeckState) => void),
      maybeListener?: (detail: never) => void
    ) {
      if (typeof eventOrListener === 'function') {
        stateListeners.add(eventOrListener);
        return () => {
          stateListeners.delete(eventOrListener);
        };
      }
      const event = eventOrListener;
      const listener = maybeListener as (detail: never) => void;
      const group = listeners.get(event) ?? new Set<(detail: never) => void>();
      group.add(listener);
      listeners.set(event, group);
      return () => {
        group.delete(listener);
        if (group.size === 0) listeners.delete(event);
      };
    },
    setOverview(open: boolean) {
      if (overview === open || destroyed) return;
      overview = open;
      emit('overview', { open, state: snapshot() });
    },
    setBlackout(active: boolean) {
      if (blackout === active || destroyed) return;
      blackout = active;
      emit('blackout', { active, state: snapshot() });
    },
    pause() {
      if (paused || destroyed) return;
      paused = true;
      scheduler?.pause();
      emit('pause', { paused: true, state: snapshot() });
    },
    resume() {
      if (!paused || destroyed) return;
      paused = false;
      scheduler?.resume();
      emit('pause', { paused: false, state: snapshot() });
    },
    handleInput(
      input: DeckInputEvent,
      inputState: DeckInputState = {},
      source: DeckActionSource = input.kind === 'swipe'
        ? 'swipe'
        : input.kind === 'key'
          ? 'keyboard'
          : 'pointer'
    ) {
      if (destroyed) return null;
      const picked = decideDeckInput(input, {
        ...inputState,
        overview: overview ? 'open' : inputState.overview,
        blackout: blackout || inputState.blackout,
        dir: inputState.dir ?? deck.meta?.dir,
      });
      if (!picked) return null;
      scheduler?.input();
      applyAction(picked, source);
      return picked;
    },
    beforeRender(extra: Partial<Omit<DeckRenderContext, 'state'>> = {}) {
      if (destroyed) return;
      const state = snapshot();
      const slide = deck.slides[state.slideIndex];
      const context: DeckRenderContext = {
        state,
        ...(slide ? { slide } : {}),
        ...extra,
      };
      for (const plugin of plugins) plugin.beforeRender?.(context);
    },
    afterRender(extra: Partial<Omit<DeckRenderContext, 'state'>> = {}) {
      if (destroyed) return;
      const state = snapshot();
      const slide = deck.slides[state.slideIndex];
      const context: DeckRenderContext = {
        state,
        ...(slide ? { slide } : {}),
        ...extra,
      };
      for (const plugin of plugins) plugin.afterRender?.(context);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scheduler?.stop();
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      for (const plugin of plugins) plugin.onDestroy?.();
      emit('destroy', { state: snapshot() });
      listeners.clear();
      stateListeners.clear();
    },
  } satisfies DeckController);

  for (const plugin of plugins) {
    const cleanup = plugin.setup?.(controller);
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  scheduler?.start();
  return controller;
}

export type { EngineSlide };
