import type { PlayerLoader } from '@texuli/catalog/player';

/** The skeleton shape a node shows while its component loads. */
export type PlayerSkeletonFamily = 'layout' | 'block' | 'chart' | 'media' | 'generic';

/** Default time a lazy loader may take before its node shows an error placeholder. */
export const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

/** Map a catalog id to the fallback skeleton shape for its family. */
export function skeletonFamily(id: string): PlayerSkeletonFamily {
  if (id.startsWith('layout-')) return 'layout';
  if (id.startsWith('blocks-')) return 'block';
  if (id.startsWith('charts-')) return 'chart';
  if (id.startsWith('media-')) return 'media';
  return 'generic';
}

/**
 * Wrap every loader so a load that never settles rejects after `timeoutMs`.
 * The player core then paints that node as a `node-error` placeholder instead
 * of a skeleton that waits forever. A non-positive or non-finite timeout
 * returns the loaders unchanged.
 */
export function withLoadTimeout(
  loaders: Readonly<Record<string, PlayerLoader>>,
  timeoutMs: number
): Readonly<Record<string, PlayerLoader>> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return loaders;
  const wrapped: Record<string, PlayerLoader> = {};
  for (const id of Object.keys(loaders)) {
    const loader = loaders[id];
    if (typeof loader !== 'function') continue;
    wrapped[id] = () =>
      new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Loading "${id}" timed out after ${timeoutMs} ms.`));
        }, timeoutMs);
        loader().then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (cause: unknown) => {
            clearTimeout(timer);
            reject(cause);
          }
        );
      });
  }
  return Object.freeze(wrapped);
}
