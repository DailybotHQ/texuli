/**
 * The analytics UA skip list — which clients must never trigger an
 * analytics request. Auditing tools (the Lighthouse family and synthetic
 * monitors) must measure the site as a first-time visitor with a stock
 * browser sees it: no analytics script, no request, no measured penalty.
 *
 * The client loader (public/umami-loader.js) applies this before
 * injecting the script. Server-side senders (the edge bot events, T-37)
 * reuse the same module so one list governs every decision about a user
 * agent; where the edge *counts* bots rather than skipping them, that is
 * a separate decision function, not a different list.
 *
 * Headless browsers are deliberately NOT skipped: they are real visitors
 * (and the site's own verification runs must see the loader fire).
 */

/** UA substrings that mark an auditing tool. Matched case-insensitively. */
export const ANALYTICS_SKIP_UA = [
  'lighthouse',
  'pagespeed',
  'gtmetrix',
  'pingdom',
  'webpagetest',
] as const;

/**
 * True when this client must not load or fire analytics. A missing user
 * agent is treated as a real client (only auditing tools self-identify).
 */
export function shouldSkipAnalytics(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return ANALYTICS_SKIP_UA.some((marker) => lower.includes(marker));
}
