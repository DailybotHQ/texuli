/**
 * The `/api/` envelope (PLAN_011 T-ar-api): one `Request` in, one
 * `Response` out, with the static file fetch, the rate limiter and the
 * clock injected so every rule is testable without a Cloudflare runtime.
 * The middleware (`functions/_middleware.ts`) sends every `/api` and
 * `/api/…` request here before any other shaping.
 *
 * The resources are files the build writes (`src/lib/api-surface.ts`).
 * This envelope adds what a static file cannot carry: the per-client token
 * bucket of the remote MCP (`createTokenBucket` in `mcp-endpoint.ts`,
 * policy `"api";q=300;w=60`) with its `RateLimit-Policy` and `RateLimit`
 * fields and a `429` with `Retry-After`, RFC 9457 problem details for
 * every miss, refusal and failure (never the HTML 404 page), the index for
 * directory-style URLs, and `X-API-Version` on every answer. The answer is
 * built here, so Cloudflare's `_headers` rules do not reach it (SECURITY
 * S-2): every header it needs is set here.
 *
 * Never here: storage, secrets, logging, or reading anything of the
 * request besides its method, path, `CF-Connecting-IP` and the conditional
 * request headers it forwards.
 */
import {
  API_PATHS,
  API_RATE_LIMIT,
  type ApiErrorCode,
  apiAssetPath,
  apiProblem,
  apiStaticHeaders,
} from '../../apps/website/src/lib/api-surface.ts';
import { createTokenBucket, rateLimitHeaders, type TokenBucket } from './mcp-endpoint.ts';

export interface ApiEndpointDeps {
  /** Fetch a built file by its root-relative path (Pages' `env.ASSETS`). */
  fetchAsset: (path: string, headers: Headers) => Promise<Response>;
  limiter: TokenBucket;
  now?: () => number;
}

/** One limiter per isolate for `/api/`, separate from the MCP's. */
export function createApiLimiter(): TokenBucket {
  return createTokenBucket(API_RATE_LIMIT);
}

const ALLOW = 'GET, HEAD, OPTIONS';

/** Forwarded to the asset fetch so `304 Not Modified` keeps working. */
const CONDITIONAL = ['if-none-match', 'if-modified-since'] as const;

/** Copied from the asset response when present. */
const VALIDATORS = ['etag', 'last-modified'] as const;

function baseHeaders(extra?: Headers): Headers {
  const headers = new Headers(apiStaticHeaders());
  headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  headers.set(
    'link',
    `<${API_PATHS.openapi}>; rel="service-desc", <${API_PATHS.docs}>; rel="service-doc"`
  );
  extra?.forEach((value, name) => {
    headers.set(name, value);
  });
  return headers;
}

function problem(code: ApiErrorCode, url: URL, method: string, extra?: Headers): Response {
  const body = apiProblem(code, url.pathname, url.origin);
  const headers = baseHeaders(extra);
  headers.set('content-type', 'application/problem+json');
  headers.set('cache-control', 'no-store');
  return new Response(method === 'HEAD' ? null : JSON.stringify(body), {
    status: body.status,
    headers,
  });
}

/** Handle one request to `/api` or a path under `/api/`. */
export async function handleApiRequest(request: Request, deps: ApiEndpointDeps): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    const headers = baseHeaders();
    headers.set('allow', ALLOW);
    headers.set('access-control-allow-methods', ALLOW);
    headers.set('access-control-allow-headers', 'Accept, If-None-Match, If-Modified-Since');
    headers.set('access-control-max-age', '600');
    return new Response(null, { status: 204, headers });
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return problem('method_not_allowed', url, method, new Headers({ allow: ALLOW }));
  }

  const now = deps.now ?? Date.now;
  const decision = deps.limiter.take(
    request.headers.get('cf-connecting-ip') ?? 'unknown',
    1,
    now()
  );
  const limits = rateLimitHeaders(deps.limiter.policy, decision);
  if (!decision.allowed) return problem('rate_limited', url, method, limits);

  const forwarded = new Headers();
  for (const name of CONDITIONAL) {
    const value = request.headers.get(name);
    if (value !== null) forwarded.set(name, value);
  }
  let asset: Response;
  try {
    asset = await deps.fetchAsset(apiAssetPath(url.pathname), forwarded);
  } catch {
    return problem('internal_error', url, method, limits);
  }
  if (asset.status === 304 || asset.status === 200) {
    const headers = baseHeaders(limits);
    for (const name of VALIDATORS) {
      const value = asset.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    if (asset.status === 304) return new Response(null, { status: 304, headers });
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(method === 'HEAD' ? null : asset.body, { status: 200, headers });
  }
  // Anything else (a miss, the host's HTML 404 page, a redirect stub) is
  // answered as a problem: HTML is never returned under /api/.
  await asset.body?.cancel();
  return problem(
    asset.status >= 500 ? 'internal_error' : 'resource_not_found',
    url,
    method,
    limits
  );
}
