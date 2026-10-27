/**
 * Site-wide constants and the analytics configuration surface.
 *
 * The analytics block follows the env-gated, proxy-first pattern from the
 * reference integration: nothing loads, sends or points anywhere until the
 * owner provisions `PUBLIC_UMAMI_WEBSITE_ID`. The loader component and the
 * track functions are separate tasks; this file only decides shapes.
 */

/** Public site origin (no trailing slash) — mirrors astro.config `site`. */
export const SITE_URL: string = (import.meta.env.SITE || 'https://texuli.com').replace(/\/$/, '');

export const SITE_NAME = 'Texuli';
export const SITE_DESCRIPTION =
  'Interfaces from texels. Owned, accessible Svelte 5 components that people and agents can build anything with.';

const umamiWebsiteId = (import.meta.env.PUBLIC_UMAMI_WEBSITE_ID || '').trim();
const umamiScriptOverride = (import.meta.env.PUBLIC_UMAMI_SCRIPT_URL || '').trim();
const umamiUseProxy = import.meta.env.PUBLIC_UMAMI_USE_PROXY !== 'false';

/**
 * The enforced page CSP allows `script-src 'self'` and `connect-src 'self'`
 * with no analytics carve-out, so only a same-origin path can load. A
 * root-relative path (`/…`, never `//…` or `/\…`, which browsers read as
 * another host) is the only accepted shape.
 */
export function isSameOriginPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

/**
 * The script the loader would inject. Direct mode (`PUBLIC_UMAMI_USE_PROXY=false`)
 * resolves to the Umami Cloud origin, which the CSP blocks, so it fails the
 * same-origin check below like any foreign override.
 */
const umamiScriptCandidate =
  umamiScriptOverride ||
  (umamiUseProxy ? '/api/umami/script.js' : 'https://cloud.umami.is/script.js');

/**
 * Analytics configuration — every consumer must treat `enabled: false` as
 * "no script, no requests, no storage". `scriptUrl` is empty when disabled
 * so a consumer can never accidentally point at an analytics origin.
 *
 * Fail closed: a script source that is not a same-origin path disables
 * analytics entirely (no markup) instead of shipping a tag the CSP would
 * silently block.
 */
const umamiEnabled =
  Boolean(umamiWebsiteId) &&
  (import.meta.env.PROD || import.meta.env.PUBLIC_UMAMI_ENABLE === 'true') &&
  isSameOriginPath(umamiScriptCandidate);

export const ANALYTICS = {
  umami: {
    websiteId: umamiWebsiteId,
    /** Production loads when an id exists; local opt-in via PUBLIC_UMAMI_ENABLE=true. */
    enabled: umamiEnabled,
    /** Inert unless enabled — even a loader bug cannot emit a script. */
    scriptUrl: umamiEnabled ? umamiScriptCandidate : '',
    /** Same-origin collect endpoint when the first-party proxy is on. */
    hostUrl: umamiEnabled && umamiUseProxy ? '/api/umami' : '',
  },
  /** Search-engine verification metas; empty means the meta is not rendered. */
  verification: {
    bing: (import.meta.env.PUBLIC_BING_SITE_VERIFICATION || '').trim(),
    google: (import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION || '').trim(),
  },
} as const;

export type UmamiAnalytics = typeof ANALYTICS.umami;
