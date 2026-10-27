/**
 * Umami loader — same-origin, cached, CSP-friendly (`script-src 'self'`,
 * no inline script, no hash bookkeeping, Trusted Types through the named
 * `texuli-analytics` policy).
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
  // Only an http(s) URL (the same-origin proxy path or the configured
  // override) is ever a script source; anything else injects nothing.
  let resolved;
  try {
    resolved = new URL(scriptSrc, location.href);
  } catch {
    return;
  }
  if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return;
  // The site enforces `require-trusted-types-for 'script'`: a plain string
  // assigned to script.src throws. The named `texuli-analytics` policy (the
  // only extra name the page CSP allows, and only on pages that mount this
  // loader) vouches for exactly the one configured URL and rejects any
  // other. Without Trusted Types support the plain string is the fallback.
  let src = scriptSrc;
  const tt = window.trustedTypes;
  if (tt && typeof tt.createPolicy === 'function') {
    try {
      const policy = tt.createPolicy('texuli-analytics', {
        createScriptURL: (url) => {
          if (url === scriptSrc) return url;
          throw new TypeError('texuli-analytics: unexpected script URL');
        },
      });
      src = policy.createScriptURL(scriptSrc);
    } catch {
      // A policy the page CSP does not allow: analytics stays off, quietly.
      return;
    }
  }
  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.setAttribute('data-website-id', websiteId);
  if (hostUrl) script.setAttribute('data-host-url', hostUrl);
  // Page views carry the path only: query strings and fragments (theme
  // share links live in `#theme=`) never reach the tracker.
  script.setAttribute('data-exclude-search', 'true');
  script.setAttribute('data-exclude-hash', 'true');
  // The track library (src/lib/track.ts) queues until this signal.
  script.addEventListener('load', () => {
    document.dispatchEvent(new CustomEvent('tx-umami-ready'));
  });
  document.head.appendChild(script);
})();
