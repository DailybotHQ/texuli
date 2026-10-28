/**
 * Injectable, deterministic auto-slide scheduler.
 *
 * Pure with respect to the clock: pass a {@link SchedulerClock} in tests.
 * User input pauses the timer (`input()`); `resume()` starts it again.
 * No DOM. The default clock reads `globalThis` only when a method is called.
 */

export interface SchedulerClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

export interface AutoSlideOptions {
  /** Interval in ms; clamped to 1_000…600_000. */
  intervalMs: number;
  /** Called when the timer fires (typically `controller.next({ source: 'auto' })`). */
  onAdvance(): void;
  clock?: SchedulerClock;
  /** Start paused (the host calls `resume()` when ready). */
  startPaused?: boolean;
}

export interface AutoSlideScheduler {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  isPaused(): boolean;
  isRunning(): boolean;
  /** User input: pause and clear the pending tick. */
  input(): void;
}

const MIN_MS = 1_000;
const MAX_MS = 600_000;

const defaultClock: SchedulerClock = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
  now: () => Date.now(),
};

export function createAutoSlideScheduler(options: AutoSlideOptions): AutoSlideScheduler {
  const clock = options.clock ?? defaultClock;
  const interval = Math.max(
    MIN_MS,
    Math.min(MAX_MS, Math.floor(Number.isFinite(options.intervalMs) ? options.intervalMs : MIN_MS))
  );
  let timer: unknown;
  let paused = options.startPaused === true;
  let stopped = true;

  const clear = (): void => {
    if (timer !== undefined) {
      clock.clearTimeout(timer);
      timer = undefined;
    }
  };

  const schedule = (): void => {
    clear();
    if (stopped || paused) return;
    timer = clock.setTimeout(() => {
      timer = undefined;
      if (stopped || paused) return;
      options.onAdvance();
      schedule();
    }, interval);
  };

  return {
    start() {
      stopped = false;
      schedule();
    },
    pause() {
      paused = true;
      clear();
    },
    resume() {
      if (stopped) return;
      paused = false;
      schedule();
    },
    stop() {
      stopped = true;
      clear();
    },
    isPaused: () => paused,
    isRunning: () => !stopped && !paused && timer !== undefined,
    input() {
      paused = true;
      clear();
    },
  };
}
