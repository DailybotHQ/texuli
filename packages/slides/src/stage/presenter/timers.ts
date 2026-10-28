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
}

export function createDeckPresenterTimers(now: () => number = Date.now): DeckPresenterTimers {
  const talk = createPresenterTimer(now);
  const onSlide = createPresenterTimer(now);
  let slideId: string | null = null;
  const start = () => {
    talk.start();
    onSlide.start();
  };
  const pause = () => {
    talk.pause();
    onSlide.pause();
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
    },
    markSlide(id) {
      if (id === slideId) return;
      slideId = id;
      onSlide.reset();
    },
  };
}

const perStage = new WeakMap<object, DeckPresenterTimers>();

/** The timers of one stage (`key` is its controller); created on first use. */
export function deckPresenterTimers(key: object, now?: () => number): DeckPresenterTimers {
  let timers = perStage.get(key);
  if (!timers) {
    timers = createDeckPresenterTimers(now);
    perStage.set(key, timers);
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
