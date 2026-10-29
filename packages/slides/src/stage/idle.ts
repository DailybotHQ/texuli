/**
 * Idle scheduling for the stage, in its own module so the stage can schedule
 * its prefetch without importing the block-family loaders (`./prefetch.ts`
 * re-exports it).
 */
export interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Run `task` when the browser is idle (or after a short timeout); returns the cancel. */
export function whenIdle(win: IdleWindow, task: () => void, timeoutMs = 2_000): () => void {
  if (typeof win.requestIdleCallback === 'function') {
    const handle = win.requestIdleCallback(task, { timeout: timeoutMs });
    return () => win.cancelIdleCallback?.(handle);
  }
  const handle = win.setTimeout(task, 200);
  return () => win.clearTimeout(handle);
}
