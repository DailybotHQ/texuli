/**
 * Media and page links through the URL policy. A media block holds a
 * reference; the host resolves it, and the `src` it returns passes
 * `safeImageSrc` at the untrusted tier, otherwise the block shows its alt
 * text. A page link's `href` comes from the host's `pageHref` (app code, so
 * the `developer` tier: relative paths pass) and still passes `safeHref`.
 */
import { safeHref, safeImageSrc } from '@texuli/core/url-policy';

/** Host media lookup: `ref` to an image source, or `null` when it is unknown. */
export type MediaResolver = (ref: string) => { src: string; alt?: string } | null | undefined;

/** The image source a media block paints, or `null` (show the alt text). */
export function mediaSource(ref: string, resolve?: MediaResolver): string | null {
  const resolved = resolve ? resolve(ref) : { src: ref };
  if (!resolved) return null;
  return safeImageSrc(resolved.src, 'untrusted') ?? null;
}

/** A page link's `href` through the URL policy, or `null` (the link becomes a button). */
export function pageLinkHref(
  ref: string,
  pageHref?: (ref: string) => string | null | undefined
): string | null {
  const href = pageHref?.(ref);
  if (!href) return null;
  return safeHref(href, 'developer') ?? null;
}
