/**
 * Page-readiness signal for E2E and prefetchers.
 *
 * Sets `data-tx-page-ready="true"` on the document root once the fonts have
 * settled, every astro-island that hydrates on load has hydrated (Astro drops
 * its `ssr` attribute; `client="idle"` and `client="visible"` islands hydrate
 * lazily and are not waited for) and two frames have painted. Site E2E specs
 * wait on this signal instead of guessing at network idle.
 *
 * Shipped as a cached same-origin file, not an inline script: the site-perf
 * document budgets are tight, and a per-page inline copy pushed the gallery
 * page over its 48 KB gzip budget. The script tag in BaseLayout.astro carries
 * `data-tx-ready-script`, which specs use to tell shell pages (wait for the
 * signal) from standalone documents such as example previews and llms.txt
 * (no signal exists; wait for load).
 */
(() => {
  const pending = () =>
    document.querySelectorAll('astro-island[ssr]:not([client="idle"]):not([client="visible"])')
      .length;
  const settled = new Promise((done) => {
    if (pending() === 0) return done();
    // Event-driven: observe ssr dropping from islands instead of polling
    // per frame — the loop must not compete with hydration for CPU time.
    const obs = new MutationObserver(() => {
      if (pending() === 0) {
        obs.disconnect();
        done();
      }
    });
    obs.observe(document, {
      attributes: true,
      attributeFilter: ['ssr'],
      subtree: true,
      childList: true,
    });
  });
  const fonts = (document.fonts && document.fonts.ready) || Promise.resolve();
  Promise.all([fonts, settled]).then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.dataset.txPageReady = 'true';
      });
    });
  });
})();
