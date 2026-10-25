import type { RenderTier } from './types.ts';

/**
 * The tier a host asked for, failing closed: only the exact string
 * `'developer'` is the developer tier; anything else (a typo, a different
 * case, an empty string, a value read from config) is `untrusted`.
 */
export function resolveTier(value: unknown): RenderTier {
  return value === 'developer' ? 'developer' : 'untrusted';
}
