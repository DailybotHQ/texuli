import { variants } from '../../internal/variants.ts';
// Side-effect: recipe-only imports still get carousel chrome.
import './carousel.css';

/**
 * Framework-free carousel behavior: index math, the swipe decision, the
 * autoplay controller and the translatable labels. `Carousel.svelte` wires
 * these to the DOM; keeping them here lets them be tested without one.
 */

/** Text direction the swipe and arrow decisions depend on. */
export type CarouselDirection = 'ltr' | 'rtl';

/**
 * The index a request lands on among `count` slides: wrapped when `loop`,
 * clamped otherwise. Fewer than one slide always yields 0.
 */
export function resolveIndex(target: number, count: number, loop: boolean): number {
  if (count <= 1 || !Number.isFinite(target)) return 0;
  const whole = Math.trunc(target);
  if (loop) return ((whole % count) + count) % count;
  return Math.min(Math.max(0, whole), count - 1);
}

/** Whether "previous" (`-1`) or "next" (`1`) can move from `index`. */
export function canStep(index: number, count: number, loop: boolean, step: -1 | 1): boolean {
  if (count <= 1) return false;
  if (loop) return true;
  return step < 0 ? index > 0 : index < count - 1;
}

/**
 * Which way a finished horizontal drag of `deltaX` CSS pixels moves: `1`
 * (next), `-1` (previous) or `0` (below the threshold). Content follows the
 * finger, so dragging toward the inline start reveals the next slide: left
 * in LTR, right in RTL.
 */
export function swipeStep(
  deltaX: number,
  threshold: number,
  direction: CarouselDirection
): -1 | 0 | 1 {
  if (!Number.isFinite(deltaX) || Math.abs(deltaX) < Math.max(1, threshold)) return 0;
  const towardStart = direction === 'rtl' ? deltaX > 0 : deltaX < 0;
  return towardStart ? 1 : -1;
}

/** Labels the carousel renders. `{index}`, `{total}` and `{label}` are filled in. */
export interface CarouselMessages {
  /** Accessible name of the carousel region when no `label` is passed. */
  carousel: string;
  /** Accessible name of the slide picker. */
  slides: string;
  previous: string;
  next: string;
  /** A picker button: `{index}` and `{label}`. */
  goTo: string;
  /** A slide's accessible name: `{index}`, `{total}` and `{label}`. */
  slide: string;
  /** The polite status after a change: `{index}` and `{total}`. */
  status: string;
  /** The visible position next to the picker: `{index}` and `{total}`. */
  count: string;
  /** The rotation control while rotation is stopped. */
  play: string;
  /** The rotation control while the slides rotate. */
  pause: string;
}

/** English defaults; override any subset with `messages`. */
export const DEFAULT_CAROUSEL_MESSAGES: Readonly<CarouselMessages> = Object.freeze({
  carousel: 'Carousel',
  slides: 'Slides',
  previous: 'Previous slide',
  next: 'Next slide',
  goTo: 'Go to slide {index}: {label}',
  slide: '{index} of {total}: {label}',
  status: 'Slide {index} of {total}',
  count: '{index} / {total}',
  play: 'Start automatic slide show',
  pause: 'Stop automatic slide show',
});

/** Merges a partial translation over the English defaults (non-strings are ignored). */
export function resolveCarouselMessages(
  overrides: Partial<CarouselMessages> = {}
): CarouselMessages {
  const keys = Object.keys(DEFAULT_CAROUSEL_MESSAGES) as (keyof CarouselMessages)[];
  return Object.fromEntries(
    keys.map((key) => {
      const value = overrides[key];
      return [key, typeof value === 'string' ? value : DEFAULT_CAROUSEL_MESSAGES[key]];
    })
  ) as unknown as CarouselMessages;
}

/**
 * Fills `{name}` placeholders. Unknown placeholders stay as written, and the
 * result is plain text: callers render it as a text node or attribute value.
 */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

/** Smallest autoplay interval, so slides never change faster than they can be read. */
export const MIN_AUTOPLAY_INTERVAL = 2000;
/** Default autoplay interval in milliseconds. */
export const DEFAULT_AUTOPLAY_INTERVAL = 5000;

/** Clamps an interval to at least {@link MIN_AUTOPLAY_INTERVAL}; invalid input gets the default. */
export function resolveInterval(interval: number | undefined): number {
  if (interval === undefined || !Number.isFinite(interval)) return DEFAULT_AUTOPLAY_INTERVAL;
  return Math.max(MIN_AUTOPLAY_INTERVAL, Math.round(interval));
}

/** Why rotation is held back for now (it resumes when every hold is released). */
export type AutoplayHold = 'hover' | 'hidden';

export interface AutoplayOptions {
  /** Milliseconds between slides (clamped by {@link resolveInterval}). */
  interval?: number;
  /** Called on every tick while rotating. */
  onTick: () => void;
  /** Called when `playing` changes (by the user, focus or `stop()`). */
  onPlayingChange?: (playing: boolean) => void;
  /** Timer functions; the defaults are the global ones. */
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Autoplay {
  /** The user's choice: rotation on. Holds can still pause it. */
  readonly playing: boolean;
  /** Whether a tick is scheduled right now (`playing` and no hold). */
  readonly running: boolean;
  play(): void;
  /** Stops rotation until `play()`: the rotation control, or focus entering the carousel. */
  stop(): void;
  toggle(): void;
  /** Pauses for a reason (pointer over the carousel, page hidden) without changing `playing`. */
  hold(reason: AutoplayHold): void;
  release(reason: AutoplayHold): void;
  /** Restarts the countdown, for example after the user changed the slide. */
  restart(): void;
  setInterval(interval: number | undefined): void;
  /** Cancels the timer for good (component teardown). */
  destroy(): void;
}

/**
 * Rotation for a carousel, following the APG carousel pattern: a rotation
 * control turns it on and off, hovering pauses it while the pointer stays,
 * and keyboard focus inside the carousel stops it until the user turns it
 * back on (the component calls `stop()` on focus). A hidden page holds it too.
 */
export function createAutoplay(options: AutoplayOptions): Autoplay {
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let interval = resolveInterval(options.interval);
  let playing = false;
  let destroyed = false;
  const holds = new Set<AutoplayHold>();
  let timer: unknown = null;

  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const schedule = () => {
    cancel();
    if (destroyed || !playing || holds.size > 0) return;
    timer = setTimer(() => {
      timer = null;
      if (destroyed || !playing || holds.size > 0) return;
      options.onTick();
      schedule();
    }, interval);
  };
  const setPlaying = (next: boolean) => {
    if (destroyed || next === playing) return;
    playing = next;
    schedule();
    options.onPlayingChange?.(playing);
  };

  return {
    get playing() {
      return playing;
    },
    get running() {
      return timer !== null;
    },
    play: () => setPlaying(true),
    stop: () => setPlaying(false),
    toggle: () => setPlaying(!playing),
    hold(reason) {
      if (holds.has(reason)) return;
      holds.add(reason);
      schedule();
    },
    release(reason) {
      if (!holds.delete(reason)) return;
      schedule();
    },
    restart: () => schedule(),
    setInterval(next) {
      interval = resolveInterval(next);
      schedule();
    },
    destroy() {
      destroyed = true;
      cancel();
    },
  };
}

/** Root classes by variant; the consumer `class` is merged last so it wins. */
export const carouselVariants = variants({
  base: 'tx-carousel',
  variants: {
    controls: {
      below: 'tx-carousel--controls-below',
      overlay: 'tx-carousel--controls-overlay',
    },
  },
  defaultVariants: { controls: 'below' },
});

/** Where the previous and next buttons sit. */
export type CarouselControlsPlacement = 'below' | 'overlay';
