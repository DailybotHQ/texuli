/**
 * Presenter timers: the elapsed talk time, the time on the current slide
 * and the wall clock, on one injectable clock (`now`). Both stopwatches are
 * the v1 `createPresenterTimer`, so pausing, resuming and resetting keep its
 * semantics. Nothing here reads a network clock or touches the DOM.
 *
 * {@link deckPresenterTimers} keeps one set per stage (keyed by its
 * controller), so closing and reopening the split view, or moving to the
 * popup window, never restarts the talk clock.
 */
import { createPresenterTimer } from '../presenter.ts';

export interface DeckPresenterTimers {
  readonly running: boolean;
  /** Elapsed milliseconds since the talk started (pauses excluded). */
  elapsed(): number;
  /** Milliseconds on the current slide (pauses excluded). */
  slide(): number;
  /** The clock reading, for the wall clock. */
  now(): number;
  start(): void;
  pause(): void;
  toggle(): void;
  /** Both stopwatches back to zero; a running set keeps running. */
  reset(): void;
  /** A new slide is shown: its stopwatch starts again from zero. */
  markSlide(slideId: string): void;
  /**
   * Called after every start, pause, toggle, reset and slide change, so a
   * status line repaints at once (no wait for its next one-second tick).
   * Returns the unsubscribe.
   */
  onChange(listener: () => void): () => void;
}

export function createDeckPresenterTimers(now: () => number = Date.now): DeckPresenterTimers {
  const talk = createPresenterTimer(now);
  const onSlide = createPresenterTimer(now);
  let slideId: string | null = null;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A failing listener never stops the clocks or the other listeners.
      }
    }
  };
  const start = () => {
    const was = talk.running;
    talk.start();
    onSlide.start();
    if (!was) changed();
  };
  const pause = () => {
    const was = talk.running;
    talk.pause();
    onSlide.pause();
    if (was) changed();
  };
  return {
    get running() {
      return talk.running;
    },
    elapsed: () => talk.elapsed(),
    slide: () => onSlide.elapsed(),
    now,
    start,
    pause,
    toggle() {
      if (talk.running) pause();
      else start();
    },
    reset() {
      talk.reset();
      onSlide.reset();
      changed();
    },
    markSlide(id) {
      if (id === slideId) return;
      slideId = id;
      onSlide.reset();
      changed();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The part of a deck controller the timers follow (`DeckController` fits). */
interface SlideSource {
  getState(): { slideId: string };
  subscribe(
    event: 'statechange',
    listener: (change: { state: { slideId: string } }) => void
  ): unknown;
}

function isSlideSource(value: object): value is SlideSource {
  const candidate = value as Partial<SlideSource>;
  return typeof candidate.getState === 'function' && typeof candidate.subscribe === 'function';
}

const perStage = new WeakMap<object, DeckPresenterTimers>();

/**
 * The timers of one stage (`key` is its controller); created on first use.
 * With a controller key the slide stopwatch restarts the moment the engine
 * moves to another slide, not when a transition later paints it.
 */
export function deckPresenterTimers(key: object, now?: () => number): DeckPresenterTimers {
  let timers = perStage.get(key);
  if (!timers) {
    const created = createDeckPresenterTimers(now);
    timers = created;
    perStage.set(key, created);
    if (isSlideSource(key)) {
      try {
        created.markSlide(key.getState().slideId);
        key.subscribe('statechange', ({ state }) => created.markSlide(state.slideId));
      } catch {
        // A controller that cannot be read leaves the slide marks to the status line.
      }
    }
  }
  return timers;
}

/** The wall clock as the locale writes hours and minutes (`9:41 AM`, `09:41`). */
export function formatWallClock(time: number, locale?: string): string {
  const date = new Date(Number.isFinite(time) ? time : 0);
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${date.getHours()}:${minutes}`;
  }
}
