/**
 * Umami loader — same-origin, cached, CSP-friendly (`script-src 'self'`,
 * no inline script, no hash bookkeeping).
 *
 * Mounted by UmamiLoader.astro ONLY when analytics is enabled
 * (`PUBLIC_UMAMI_WEBSITE_ID` set, production or an explicit dev opt-in):
 * the tag carries the script source, website id and collect endpoint as
 * data attributes. The loader re-checks the audience before injecting —
 * auditing tools (Lighthouse family, synthetic monitors) get zero
 * analytics requests. With analytics disabled the component renders
 * nothing and this file is never requested: the default site is
 * provably silent.
 *
 * The skip markers duplicate apps/website/src/lib/umami-skip.ts (the
 * unit-tested source of truth): public/ files ship unbundled, and the
 * umami-loader test guards the two against drift.
 */
(() => {
  const SKIP_UA = ['lighthouse', 'pagespeed', 'gtmetrix', 'pingdom', 'webpagetest'];
  const tag = document.querySelector('script[data-umami-loader]');
  if (!tag) return;
  const scriptSrc = tag.getAttribute('data-script-src');
  const websiteId = tag.getAttribute('data-website-id');
  const hostUrl = tag.getAttribute('data-host-url') || '';
  if (!scriptSrc || !websiteId) return;
  const ua = (navigator.userAgent || '').toLowerCase();
  if (SKIP_UA.some((marker) => ua.includes(marker))) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = scriptSrc;
  script.setAttribute('data-website-id', websiteId);
  if (hostUrl) script.setAttribute('data-host-url', hostUrl);
  // The track library (src/lib/track.ts) queues until this signal.
  script.addEventListener('load', () => {
    document.dispatchEvent(new CustomEvent('tx-umami-ready'));
  });
  document.head.appendChild(script);
})();
