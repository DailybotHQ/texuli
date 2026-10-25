/** A local elapsed-time stopwatch for presenter mode. It never reads a network clock. */
export interface PresenterTimer {
  readonly running: boolean;
  /** Elapsed milliseconds, including the current running span. */
  elapsed(): number;
  start(): void;
  pause(): void;
  /** Return to zero; a running timer keeps running from zero. */
  reset(): void;
}

export function createPresenterTimer(now: () => number = Date.now): PresenterTimer {
  let accumulated = 0;
  let startedAt: number | null = null;
  return {
    get running() {
      return startedAt !== null;
    },
    elapsed() {
      return accumulated + (startedAt === null ? 0 : Math.max(0, now() - startedAt));
    },
    start() {
      if (startedAt === null) startedAt = now();
    },
    pause() {
      if (startedAt === null) return;
      accumulated += Math.max(0, now() - startedAt);
      startedAt = null;
    },
    reset() {
      accumulated = 0;
      if (startedAt !== null) startedAt = now();
    },
  };
}

/** Format elapsed milliseconds as `m:ss`, or `h:mm:ss` from one hour. */
export function formatElapsed(milliseconds: number): string {
  const total = Number.isFinite(milliseconds) ? Math.max(0, Math.floor(milliseconds / 1000)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
