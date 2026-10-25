export type InfiniteLoaderStatus = 'idle' | 'loading' | 'error' | 'exhausted';

export interface InfiniteLoaderOptions {
  /** Current item count; read before every request. */
  getItemCount: () => number;
  /** Load another page. Resolve only after the items have been appended. */
  loadMore: () => Promise<void>;
  /** Load when this many items or fewer remain after the rendered range. Defaults to 5. */
  threshold?: number;
  /** Optional exhaustion signal. Defaults to true. */
  hasMore?: () => boolean;
}

export interface InfiniteLoader {
  readonly status: InfiniteLoaderStatus;
  readonly error: unknown;
  /** Check the first unrendered index and load at most one page at a time. */
  check(endIndex: number): Promise<void>;
  /** Clear a failed state so the next check can retry. */
  resetError(): void;
}

/**
 * Create a framework-free infinite loader. Repeated range checks share one
 * in-flight request, and a rejection is exposed for explicit retry.
 */
export function createInfiniteLoader(options: InfiniteLoaderOptions): InfiniteLoader {
  const threshold = Number.isFinite(options.threshold)
    ? Math.max(0, Math.floor(options.threshold ?? 0))
    : 5;
  const hasMore = options.hasMore ?? (() => true);
  let currentStatus: InfiniteLoaderStatus = 'idle';
  let currentError: unknown;
  let active: Promise<void> | undefined;

  return {
    get status() {
      return currentStatus;
    },
    get error() {
      return currentError;
    },
    async check(endIndex) {
      if (active) return active;
      if (currentStatus === 'error') return;
      if (!hasMore()) {
        currentStatus = 'exhausted';
        return;
      }
      const currentCount = options.getItemCount();
      const count = Math.max(0, Number.isFinite(currentCount) ? currentCount : 0);
      const safeEnd = Math.max(0, Number.isFinite(endIndex) ? Math.floor(endIndex) : 0);
      if (count - safeEnd > threshold) return;

      currentStatus = 'loading';
      currentError = undefined;
      active = options
        .loadMore()
        .then(() => {
          currentStatus = hasMore() ? 'idle' : 'exhausted';
        })
        .catch((error: unknown) => {
          currentError = error;
          currentStatus = 'error';
        })
        .finally(() => {
          active = undefined;
        });
      return active;
    },
    resetError() {
      if (currentStatus === 'error') {
        currentError = undefined;
        currentStatus = 'idle';
      }
    },
  };
}
