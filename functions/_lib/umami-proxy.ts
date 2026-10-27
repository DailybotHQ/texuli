/**
 * Umami proxy upstream request shaping (T-36) — the non-pure half that
 * the route uses. Only an explicit allowlist of headers is forwarded:
 * content type (beacon POSTs), the client IP as x-forwarded-for and the
 * user agent (both feed Umami's geo/device dimensions). Cookies,
 * authorization and every other header are dropped by omission, and
 * nothing about a request is logged. Beacon bodies are bounded
 * ({@link UMAMI_PROXY_BODY_MAX}) and upstream redirects are never
 * followed.
 */
import type { UmamiProxyDecision } from '../../apps/website/src/lib/umami-proxy-filter.ts';

/** The largest beacon body the proxy reads or forwards: 16 KB. */
export const UMAMI_PROXY_BODY_MAX = 16 * 1024;

/** True for `application/json`, with or without parameters (charset). */
export function isJsonContentType(value: string | null): boolean {
  return (value ?? '').split(';')[0]?.trim().toLowerCase() === 'application/json';
}

/**
 * Read a request body up to `limit` bytes. Returns null — and stops
 * reading — as soon as the declared `content-length` or the bytes read
 * pass the limit, so an oversized beacon never sits in memory whole.
 */
export async function readBoundedBody(
  request: Request,
  limit: number = UMAMI_PROXY_BODY_MAX
): Promise<ArrayBuffer | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && !(Number(declared) <= limit)) return null;
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export function buildUmamiUpstreamRequest(
  request: Request,
  decision: Extract<UmamiProxyDecision, { action: 'forward' }>,
  body?: ArrayBuffer
): RequestInit {
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
    // Never follow: a redirecting upstream is an unavailable upstream (the
    // route answers 503), not a hop to wherever it points.
    redirect: 'manual',
    body: decision.method === 'POST' ? body : undefined,
  };
}
