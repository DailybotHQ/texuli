/**
 * The first-party Umami proxy's decision layer (T-36) — pure, unit-tested,
 * shared by the edge route. Everything that decides whether a request may
 * pass lives here; the route only reads its env, fetches and reshapes.
 *
 * The proxy exists to keep the site foreign-request-free: the browser
 * speaks only to same-origin `/api/umami/*`, and this filter allows
 * exactly two shapes through — `GET script.js` and `POST api/send` —
 * with no query string, no cookies and no arbitrary forwarding. The
 * upstream origin itself is never hardcoded: it is owner-provisioned as
 * the server-side `UMAMI_ENDPOINT_ORIGIN` env at the consent checkpoint,
 * and a missing value is a deliberate 503 off state, never a default.
 */

export type UmamiProxyUpstreamPath = 'script.js' | 'api/send';

/** Every status the proxy answers with a problem body. */
export type UmamiProxyStatus = 404 | 405 | 413 | 415 | 503;

export type UmamiProxyDecision =
  | { action: 'forward'; upstreamPath: UmamiProxyUpstreamPath; method: 'GET' | 'POST' }
  | { action: 'reject'; status: 404 | 405 | 503; title: string; allow?: string };

/**
 * Normalize the Pages `[[path]]` catch-all. No default: a bare
 * `/api/umami` resolves to the empty path, which the filter rejects.
 * Traversal segments are kept for the filter to reject — this function
 * only joins and trims, it never decides.
 */
export function resolveUmamiProxyPath(raw: string | string[] | undefined): string {
  const joined = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
  return joined.split('/').filter(Boolean).join('/');
}

/** The one decision: may this path+method pass, and as what? */
export function decideUmamiProxy(path: string, method: string): UmamiProxyDecision {
  const verb = method.toUpperCase();
  if (path === 'script.js') {
    if (verb === 'GET') return { action: 'forward', upstreamPath: 'script.js', method: 'GET' };
    return { action: 'reject', status: 405, title: 'Method Not Allowed', allow: 'GET' };
  }
  if (path === 'api/send') {
    if (verb === 'POST') return { action: 'forward', upstreamPath: 'api/send', method: 'POST' };
    return { action: 'reject', status: 405, title: 'Method Not Allowed', allow: 'POST' };
  }
  return { action: 'reject', status: 404, title: 'Not Found' };
}

/** Per-path response caching: the tracker script is stable; beacons never. */
export function getUmamiProxyCacheControl(path: string): string {
  return path === 'script.js' ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-store';
}

/** RFC 9457 body for a rejection, matching the middleware's agent 404s. */
export function umamiProxyProblem(status: UmamiProxyStatus, title: string): string {
  return JSON.stringify({ type: 'about:blank', title, status });
}
