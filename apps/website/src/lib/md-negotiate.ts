/**
 * The middleware-facing decision for markdown content negotiation (T-26):
 * one pure function a Pages Functions wrapper calls per request. Delegates
 * to the T-23 pure helpers — `prefersMarkdown` parses the Accept header and
 * `markdownTwinFor` maps a docs page to its twin — so the site and the edge
 * can never disagree about what negotiates.
 */

import { markdownTwinFor, prefersMarkdown } from '../components/docs/markdown-negotiation.ts';
import { isDocsPath } from '../components/foundation/nav-data.ts';

/** What the middleware should serve for one request. */
export interface NegotiationDecision {
  /** The twin URL to fetch from assets (`/guides/theming.md`). */
  twin: string;
  /** Headers every twin response carries. */
  headers: Record<string, string>;
}

/**
 * The twin decision for a request: a twin URL with its response headers
 * when the path is a docs page and the request explicitly prefers
 * `text/markdown`, `null` otherwise (the wrapper passes the request
 * through untouched).
 */
export function negotiateTwin(pathname: string, accept: string | null): NegotiationDecision | null {
  if (!prefersMarkdown(accept)) return null;
  // Only docs-class pages carry twins; anything else (galleries, studios,
  // the root) serves HTML to everyone.
  if (!isDocsPath(pathname)) return null;
  const twin = markdownTwinFor(pathname);
  if (!twin) return null;
  return {
    twin,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      vary: 'Accept',
      'x-content-negotiation': 'markdown',
    },
  };
}
