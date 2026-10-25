import type { HrefTrust } from '../url/safe-href.ts';
import {
  cleanSource,
  isBlockedSource,
  isValidBlobSource,
  normalizedHttpsOrigins,
  sourceScheme,
} from './shared.ts';
import { resolveTrust } from './trust.ts';

/** Options for validating media URLs supplied by untrusted content. */
export type SafeMediaSrcOptions = {
  /** Exact HTTPS origins allowed to provide untrusted media. */
  allowedOrigins?: readonly string[];
};

/**
 * Validate a URL for audio or video. Untrusted media must be a blob URL or
 * come from an explicitly allowlisted HTTPS origin. Developer media may also
 * use HTTP and relative asset paths. `data:` is never accepted for media.
 */
export function safeMediaSrc(
  value: unknown,
  requested: HrefTrust = 'untrusted',
  options: SafeMediaSrcOptions = {}
): string | undefined {
  const trust = resolveTrust(requested);
  const source = cleanSource(value);
  if (!source || isBlockedSource(source)) return undefined;

  const scheme = sourceScheme(source);
  if (scheme === 'blob') return isValidBlobSource(source) ? source : undefined;
  if (scheme !== 'http' && scheme !== 'https' && scheme !== undefined) return undefined;

  let parsed: URL;
  try {
    parsed = scheme ? new URL(source) : new URL(source, 'https://texuli.invalid');
  } catch {
    return undefined;
  }
  if (parsed.username !== '' || parsed.password !== '') return undefined;

  if (trust === 'developer') return source;
  if (scheme !== 'https') return undefined;
  return normalizedHttpsOrigins(options.allowedOrigins).has(parsed.origin) ? source : undefined;
}
