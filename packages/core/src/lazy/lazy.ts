/**
 * Shared import-promise cache for lazy UI chunks.
 *
 * Layout hosts and optional chrome (drawers, menus, lightbox) call this so
 * concurrent effect re-runs under parallel tests share one load instead of
 * cancelling each other and leaving readiness stuck.
 */

const CACHE = new Map<string, Promise<unknown>>();

/**
 * Return a single shared promise for `key`. Failures clear the entry so the
 * next call can retry.
 */
export function lazyChunk<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = CACHE.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = load().then(
    (value) => value,
    (error: unknown) => {
      CACHE.delete(key);
      throw error;
    }
  );
  CACHE.set(key, pending);
  return pending;
}

/** Drop one cached chunk (tests). */
export function clearLazyChunk(key: string): void {
  CACHE.delete(key);
}

/** Drop every cached chunk (tests). */
export function clearLazyChunks(): void {
  CACHE.clear();
}

/** Whether a key is currently cached (settled or in flight). */
export function hasLazyChunk(key: string): boolean {
  return CACHE.has(key);
}
