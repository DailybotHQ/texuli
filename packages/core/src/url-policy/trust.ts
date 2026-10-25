import type { HrefTrust } from '../url/safe-href.ts';

/**
 * The trust tier a caller asked for, failing closed: only the exact string
 * `'developer'` is the developer tier. Anything else (another case, an empty
 * string, `null`, a value read from config) is `'untrusted'`. Every URL policy
 * entry point resolves its tier through this one rule.
 */
export function resolveTrust(value: unknown): HrefTrust {
  return value === 'developer' ? 'developer' : 'untrusted';
}
