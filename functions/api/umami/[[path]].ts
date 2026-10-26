/**
 * First-party Umami proxy (T-36) — the site's only analytics endpoint.
 * Same-origin for the browser (no CSP carve-out for a foreign analytics
 * origin, ever), allowlisted here: `GET /api/umami/script.js` and
 * `POST /api/umami/api/send`, nothing else, no query string. The upstream
 * origin comes from the server-side `UMAMI_ENDPOINT_ORIGIN` env,
 * owner-provisioned at the consent checkpoint; without it the proxy is a
 * deliberate 503 off state — never a hardcoded default. No cookies, no
 * authorization headers, no logging of bodies or IPs.
 */
import {
  decideUmamiProxy,
  getUmamiProxyCacheControl,
  resolveUmamiProxyPath,
  umamiProxyProblem,
} from '../../../apps/website/src/lib/umami-proxy-filter.ts';
import { buildUmamiUpstreamRequest } from '../../_lib/umami-proxy.ts';

/** The pieces of the Pages function environment this route touches. */
interface Env {
  UMAMI_ENDPOINT_ORIGIN?: string;
}

interface EventContext {
  request: Request;
  params: { path?: string | string[] };
  env: Env;
}

function problemResponse(status: 404 | 405 | 503, title: string, allow?: string): Response {
  const headers = new Headers({ 'content-type': 'application/problem+json' });
  if (allow) headers.set('allow', allow);
  return new Response(umamiProxyProblem(status, title), { status, headers });
}

export async function onRequest(context: EventContext): Promise<Response> {
  const path = resolveUmamiProxyPath(context.params?.path);
  const decision = decideUmamiProxy(path, context.request.method);
  if (decision.action === 'reject') {
    return problemResponse(decision.status, decision.title, decision.allow);
  }

  const origin = (context.env.UMAMI_ENDPOINT_ORIGIN || '').trim().replace(/\/+$/, '');
  if (!origin) {
    return problemResponse(503, 'Analytics endpoint not provisioned');
  }

  const init = await buildUmamiUpstreamRequest(context.request, decision);
  let upstream: Response;
  try {
    upstream = await fetch(new URL(decision.upstreamPath, `${origin}/`), init);
  } catch {
    // Upstream unreachable: fail the beacon, never the page, never loudly.
    return problemResponse(503, 'Analytics endpoint unreachable');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': getUmamiProxyCacheControl(path),
    },
  });
}
