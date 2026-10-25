import { type HrefTrust, hasInvisibleFormatting } from '../url/safe-href.ts';
import {
  cleanSource,
  isAllowedRelativeOrWebSource,
  isBlockedSource,
  isSafeDataImage,
  isValidBlobSource,
  sourceScheme,
} from './shared.ts';
import { resolveTrust } from './trust.ts';

/**
 * A relative image path an agent may use: no invisible formatting
 * characters, and no colon in its first segment. RFC 3986 already requires
 * `./` before such a segment; refusing it also refuses scheme look-alikes
 * (zero-width or fullwidth `javascript:`, `&#106;avascript:`) that a browser
 * would only ever resolve as same-origin paths.
 */
function isPlainRelativePath(source: string): boolean {
  if (hasInvisibleFormatting(source)) return false;
  // Stricter than RFC 3986 (which also ends the segment at '#'): any colon
  // before the first '/' or '?' reads as a scheme and is refused.
  const firstSegment = source.split(/[/?]/, 1)[0] ?? '';
  return !firstSegment.includes(':');
}

/**
 * Validate a URL for an image source. Untrusted content may use HTTPS or a
 * relative asset path; developer-authored images may also use HTTP, blob URLs,
 * or a bounded base64 raster data image. Unsafe values return `undefined`.
 */
export function safeImageSrc(
  value: unknown,
  requested: HrefTrust = 'untrusted'
): string | undefined {
  const trust = resolveTrust(requested);
  if (typeof value === 'string') {
    const dataSource = value.trim();
    if (sourceScheme(dataSource) === 'data') {
      return trust === 'developer' && isSafeDataImage(dataSource) ? dataSource : undefined;
    }
  }
  const source = cleanSource(value);
  if (!source || isBlockedSource(source)) return undefined;

  if (sourceScheme(source) === 'blob') {
    return trust === 'developer' && isValidBlobSource(source) ? source : undefined;
  }
  if (!isAllowedRelativeOrWebSource(source)) return undefined;
  if (trust === 'untrusted') {
    if (sourceScheme(source) === 'http') return undefined;
    if (sourceScheme(source) === undefined && !isPlainRelativePath(source)) return undefined;
  }
  return source;
}
