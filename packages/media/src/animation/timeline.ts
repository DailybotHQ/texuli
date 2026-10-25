import type { TimelineListener, TimelineState } from './types.ts';

export type CreateTimelineOptions = {
  durationMs: number;
  loop?: boolean;
  /** When true, play() is a no-op and time stays at stillTimeMs. */
  reducedMotion?: boolean;
  stillTimeMs?: number;
  /** Injected clock for tests. */
  now?: () => number;
  /** Injected rAF / cAF for tests. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
};

export type CompositionTimeline = {
  getState: () => TimelineState;
  play: () => void;
  pause: () => void;
  seek: (timeMs: number) => void;
  setReducedMotion: (value: boolean) => void;
  subscribe: (listener: TimelineListener) => () => void;
  dispose: () => void;
};

/**
 * Lightweight playhead. Pure time math; drawing is the host’s job via subscribe.
 */
export function createTimeline(options: CreateTimelineOptions): CompositionTimeline {
  const durationMs = Math.max(1, options.durationMs);
  const loop = options.loop === true;
  let reducedMotion = options.reducedMotion === true;
  const stillTimeMs = Math.min(Math.max(0, options.stillTimeMs ?? 0), durationMs);

  const now = options.now ?? (() => performance.now());
  const requestFrame =
    options.requestFrame ??
    ((cb: FrameRequestCallback) =>
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(cb)
        : (setTimeout(() => cb(now()), 16) as unknown as number));
  const cancelFrame =
    options.cancelFrame ??
    ((id: number) => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
      else clearTimeout(id);
    });

  let timeMs = reducedMotion ? stillTimeMs : 0;
  let playing = false;
  let anchorPerf = 0;
  let anchorTime = 0;
  let frameId: number | null = null;
  const listeners = new Set<TimelineListener>();

  function state(): TimelineState {
    return {
      timeMs,
      playing,
      durationMs,
      loop,
      reducedMotion,
    };
  }

  function emit(): void {
    const snapshot = state();
    for (const listener of listeners) listener(snapshot);
  }

  function tick(perfNow: number): void {
    if (!playing || reducedMotion) return;
    const elapsed = perfNow - anchorPerf;
    let next = anchorTime + elapsed;
    if (loop) {
      next = ((next % durationMs) + durationMs) % durationMs;
    } else if (next >= durationMs) {
      next = durationMs;
      playing = false;
      timeMs = next;
      frameId = null;
      emit();
      return;
    }
    timeMs = next;
    emit();
    frameId = requestFrame(tick);
  }

  function stopFrame(): void {
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
  }

  return {
    getState: () => state(),
    play(): void {
      if (reducedMotion || playing) return;
      if (!loop && timeMs >= durationMs) timeMs = 0;
      playing = true;
      anchorPerf = now();
      anchorTime = timeMs;
      emit();
      frameId = requestFrame(tick);
    },
    pause(): void {
      if (!playing) return;
      playing = false;
      stopFrame();
      emit();
    },
    seek(next: number): void {
      const clamped = loop
        ? ((next % durationMs) + durationMs) % durationMs
        : Math.min(Math.max(0, next), durationMs);
      timeMs = reducedMotion ? stillTimeMs : clamped;
      if (playing) {
        anchorPerf = now();
        anchorTime = timeMs;
      }
      emit();
    },
    setReducedMotion(value: boolean): void {
      reducedMotion = value;
      if (reducedMotion) {
        playing = false;
        stopFrame();
        timeMs = stillTimeMs;
      }
      emit();
    },
    subscribe(listener: TimelineListener): () => void {
      listeners.add(listener);
      listener(state());
      return () => {
        listeners.delete(listener);
      };
    },
    dispose(): void {
      playing = false;
      stopFrame();
      listeners.clear();
    },
  };
}
