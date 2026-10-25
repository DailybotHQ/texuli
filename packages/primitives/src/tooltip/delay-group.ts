export interface TooltipDelayGroupOptions {
  delayDuration?: number;
  skipDelayDuration?: number;
}

export interface TooltipDelayGroup {
  /** Delay for the next pointer-open, or zero while the group is in its skip window. */
  openDelay(): number;
  /** A tooltip became visible; adjacent tooltips may open without the initial delay. */
  opened(): void;
  /** Start the window after which the initial delay is restored. */
  closed(): void;
  /** Update durations without losing the current open/skip state. */
  configure(options: TooltipDelayGroupOptions): void;
  /** Release the pending skip timer when its provider is destroyed. */
  destroy(): void;
}

function duration(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;
}

/**
 * Shared delay state for a group of tooltips. The first hover waits; after one
 * opens, switching between nearby tooltips skips the delay for a short window.
 */
export function createTooltipDelayGroup(options: TooltipDelayGroupOptions = {}): TooltipDelayGroup {
  let delayDuration = duration(options.delayDuration, 300);
  let skipDelayDuration = duration(options.skipDelayDuration, 300);
  let skip = false;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const clearReset = () => {
    if (resetTimer !== undefined) clearTimeout(resetTimer);
    resetTimer = undefined;
  };

  return {
    openDelay: () => (skip ? 0 : delayDuration),
    opened() {
      clearReset();
      skip = true;
    },
    closed() {
      clearReset();
      if (!skip) return;
      resetTimer = setTimeout(() => {
        skip = false;
        resetTimer = undefined;
      }, skipDelayDuration);
    },
    configure(next) {
      delayDuration = duration(next.delayDuration, delayDuration);
      skipDelayDuration = duration(next.skipDelayDuration, skipDelayDuration);
    },
    destroy() {
      clearReset();
      skip = false;
    },
  };
}
