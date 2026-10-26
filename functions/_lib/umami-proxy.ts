/**
 * Umami proxy upstream request shaping (T-36) — the non-pure half that
 * the route uses. Only an explicit allowlist of headers is forwarded:
 * content type (beacon POSTs), the client IP as x-forwarded-for and the
 * user agent (both feed Umami's geo/device dimensions). Cookies,
 * authorization and every other header are dropped by omission, and
 * nothing about a request is logged.
 */
import type { UmamiProxyDecision } from '../../apps/website/src/lib/umami-proxy-filter.ts';

export async function buildUmamiUpstreamRequest(
  request: Request,
  decision: Extract<UmamiProxyDecision, { action: 'forward' }>
): Promise<RequestInit> {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);

  return {
    method: decision.method,
    headers,
    // Do not hold a live upstream stream across the isolate boundary.
    redirect: 'follow',
    body: decision.method === 'POST' ? await request.arrayBuffer() : undefined,
  };
}
