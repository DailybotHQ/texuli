/**
 * Outbound documentation link tracking (T-38): one delegated, passive
 * click listener for the whole document — no per-link listeners, no
 * layout shift, nothing on the interaction path beyond one `closest()`.
 * External http(s) links emit the catalog's `outbound_doc_link` event
 * with the resolved URL; same-origin links, fragments and non-http
 * schemes emit nothing. Idempotent: a document attribute guards against
 * double setup.
 */
import { EVENTS } from './analytics.ts';
import { track } from './track.ts';

const BOUND_FLAG = 'data-tx-outbound-bound';

export function setupOutboundDocTracking(root: Document = document): void {
  if (typeof document === 'undefined') return;
  if (root.documentElement.hasAttribute(BOUND_FLAG)) return;
  root.documentElement.setAttribute(BOUND_FLAG, '');
  root.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      let resolved: URL;
      try {
        resolved = new URL(href, location.href);
      } catch {
        return;
      }
      if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return;
      if (resolved.origin === location.origin) return;
      track(EVENTS.OUTBOUND_DOC_LINK, { url: resolved.href });
    },
    { passive: true }
  );
}
