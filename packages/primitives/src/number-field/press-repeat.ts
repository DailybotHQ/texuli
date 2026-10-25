/**
 * Press-and-hold repeat for stepper buttons: one step on press, then after
 * `delay` a step every `interval` until released or until `step` returns
 * `false` (a bound was reached). Timers are injectable for tests.
 */
export interface PressRepeatOptions {
  /** Perform one step; return `false` to stop repeating. */
  step: () => boolean;
  delay?: number;
  interval?: number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface PressRepeat {
  start(): void;
  stop(): void;
  isActive(): boolean;
}

export const PRESS_REPEAT_DELAY = 400;
export const PRESS_REPEAT_INTERVAL = 60;

export function createPressRepeat(options: PressRepeatOptions): PressRepeat {
  const delay = options.delay ?? PRESS_REPEAT_DELAY;
  const interval = options.interval ?? PRESS_REPEAT_INTERVAL;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let handle: unknown = null;
  let active = false;

  const tick = () => {
    if (!active) return;
    if (!options.step()) {
      stop();
      return;
    }
    handle = setTimer(tick, interval);
  };

  function stop() {
    active = false;
    if (handle !== null) clearTimer(handle);
    handle = null;
  }

  return {
    start() {
      stop();
      active = true;
      if (!options.step()) {
        stop();
        return;
      }
      handle = setTimer(tick, delay);
    },
    stop,
    isActive: () => active,
  };
}
