/**
 * The remote MCP endpoint's HTTP envelope (T-mcp-remote, ADR-018): one
 * `Request` in, one `Response` out, with the JSON-RPC handler, the rate
 * limiter and the clock injected so every rule is testable without a
 * Cloudflare runtime. Stateless Streamable HTTP with JSON responses only: no
 * SSE stream, no session id, nothing stored between requests.
 *
 * Order of checks on a POST, cheapest first: Host (DNS rebinding), Origin
 * (browsers must be allowlisted; server agents send none), the per-client
 * token bucket, Content-Type, Accept, the `MCP-Protocol-Version` header, the
 * body (at most {@link MCP_BODY_MAX} bytes, counted while streaming and
 * refused as soon as it passes the cap), JSON, the batch cap, and then each
 * message through the handler under the {@link MCP_CALL_TIMEOUT_MS} guard.
 * Every answer carries the endpoint's own security headers: Cloudflare's
 * `_headers` file never applies to a Function response (SECURITY S-2).
 *
 * Never here: network fetch, storage, secrets, logging, or reading anything
 * of the request besides the headers named above and the body.
 */
import { isAgentRequest } from '../../apps/website/src/lib/agent-request.ts';
import { isJsonContentType, readBoundedBody } from './umami-proxy.ts';

/** The largest request body the endpoint reads: 256 KB. */
export const MCP_BODY_MAX = 256 * 1024;

/** The most JSON-RPC messages one batch may carry. */
export const MCP_BATCH_MAX = 10;

/** The wall-clock guard around each message (operations may declare less). */
export const MCP_CALL_TIMEOUT_MS = 5000;

/** Where a person or agent learns how to use the endpoint. */
export const MCP_DOCS_URL =
  'https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/mcp.md';

/** The static MCP server card the site publishes. */
export const MCP_SERVER_CARD_PATH = '/.well-known/mcp/server-card.json';

/** The token-bucket policy: `capacity` requests, refilled evenly over `windowSeconds`. */
export interface RatePolicy {
  /** The policy name in the RateLimit header fields. */
  name: string;
  capacity: number;
  windowSeconds: number;
}

/** 60 messages per client per minute, with bursts up to 60 (per isolate). */
export const MCP_RATE_POLICY: RatePolicy = Object.freeze({
  name: 'mcp',
  capacity: 60,
  windowSeconds: 60,
});

export interface RateDecision {
  allowed: boolean;
  /** Whole tokens left after this request. */
  remaining: number;
  /** Seconds until the bucket is full again. */
  resetSeconds: number;
  /** Seconds until this request's cost fits (0 when allowed). */
  retryAfterSeconds: number;
}

export interface TokenBucket {
  readonly policy: RatePolicy;
  take(key: string, cost: number, now?: number): RateDecision;
  /** Tracked clients (for the memory cap test). */
  size(): number;
}

/**
 * A per-isolate token bucket keyed by client. Best-effort by design:
 * Cloudflare runs many isolates and recycles them, so a client spread across
 * isolates gets a multiple of the quota; the Cloudflare rate-limiting rule
 * (docs/SECURITY.md) is the durable layer. At most `maxKeys` clients are
 * tracked: the oldest one is dropped first, so a flood of addresses cannot
 * grow memory.
 */
export function createTokenBucket(
  policy: RatePolicy,
  options: { maxKeys?: number } = {}
): TokenBucket {
  const maxKeys = Math.max(1, options.maxKeys ?? 10_000);
  const perMs = policy.capacity / (policy.windowSeconds * 1000);
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    policy,
    size: () => buckets.size,
    take(key, cost, now = Date.now()) {
      let bucket = buckets.get(key);
      if (bucket) {
        bucket.tokens = Math.min(policy.capacity, bucket.tokens + (now - bucket.at) * perMs);
        bucket.at = now;
      } else {
        while (buckets.size >= maxKeys) {
          const oldest = buckets.keys().next().value;
          if (oldest === undefined) break;
          buckets.delete(oldest);
        }
        bucket = { tokens: policy.capacity, at: now };
        buckets.set(key, bucket);
      }
      const allowed = bucket.tokens >= cost;
      if (allowed) bucket.tokens -= cost;
      const missing = policy.capacity - bucket.tokens;
      return {
        allowed,
        remaining: Math.max(0, Math.floor(bucket.tokens)),
        resetSeconds: Math.ceil(missing / perMs / 1000),
        retryAfterSeconds: allowed
          ? 0
          : Math.max(
              1,
              Math.ceil((Math.min(cost, policy.capacity) - bucket.tokens) / perMs / 1000)
            ),
      };
    },
  };
}

/** The `RateLimit-Policy` and `RateLimit` fields (draft-ietf-httpapi-ratelimit-headers). */
export function rateLimitHeaders(policy: RatePolicy, decision: RateDecision): Headers {
  const headers = new Headers({
    'ratelimit-policy': `"${policy.name}";q=${policy.capacity};w=${policy.windowSeconds}`,
    ratelimit: `"${policy.name}";r=${decision.remaining};t=${decision.resetSeconds}`,
  });
  if (!decision.allowed) headers.set('retry-after', String(decision.retryAfterSeconds));
  return headers;
}

const TEXULI_ORIGIN =
  /^https:\/\/(?:texuli\.com|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)?texuli\.pages\.dev)$/u;
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/u;
const TEXULI_HOST =
  /^(?:texuli\.com|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)?texuli\.pages\.dev)$/u;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Browsers must send one of these origins: texuli.com, the Pages preview
 * hosts (one label under texuli.pages.dev) and localhost for local tests.
 * `null` (an opaque origin) is refused.
 */
export function isAllowedOrigin(origin: string): boolean {
  return TEXULI_ORIGIN.test(origin) || LOCAL_ORIGIN.test(origin);
}

/** The hosts the endpoint answers on (a DNS-rebinding defense). */
export function isAllowedHost(hostname: string): boolean {
  return TEXULI_HOST.test(hostname) || LOCAL_HOSTS.has(hostname);
}

/** The hostname of a `Host` header value (port dropped), or null when it is not one. */
function hostnameOf(host: string): string | null {
  try {
    const url = new URL(`http://${host}`);
    return url.host === host.toLowerCase() || url.hostname === host.toLowerCase()
      ? url.hostname
      : null;
  } catch {
    return null;
  }
}

/** A JSON-RPC message handler (`createMcpHandler` in stateless mode). */
export type JsonRpcHandler = (
  message: unknown,
  context: { protocolVersion?: string }
) => Promise<unknown>;

export interface McpEndpointDeps {
  handler: JsonRpcHandler;
  /** The protocol versions the handler negotiates (checked against the header). */
  supportedVersions: readonly string[];
  limiter: TokenBucket;
  /** Every tool name the handler serves: the only tool names a counter may carry. */
  knownOperations: ReadonlySet<string>;
  /** The server card agents get on GET (the site's static card). */
  serverCard?: unknown;
  /** The time guard per message (default {@link MCP_CALL_TIMEOUT_MS}). */
  timeoutMs?: number;
  now?: () => number;
}

/** What a counter records about one request that reached the handler. */
export interface McpCounter {
  operation: string;
  status: number;
  durationMs: number;
}

export interface McpHttpResult {
  response: Response;
  /** Present only for requests that reached the handler. */
  counter?: McpCounter;
}

const ALLOW = 'POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id';
const EXPOSE_HEADERS = 'MCP-Protocol-Version, RateLimit, RateLimit-Policy, Retry-After';

/** Methods whose name a counter may carry; anything else is `unknown`. */
const KNOWN_METHODS = new Set([
  'initialize',
  'ping',
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'prompts/list',
  'prompts/get',
  'completion/complete',
  'notifications/initialized',
  'notifications/cancelled',
]);

/** The headers every answer carries, plus CORS for an allowed browser origin. */
function baseHeaders(allowedOrigin: string | null): Headers {
  const headers = new Headers({
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
    'referrer-policy': 'no-referrer',
    vary: 'Origin',
  });
  if (allowedOrigin) {
    headers.set('access-control-allow-origin', allowedOrigin);
    headers.set('access-control-expose-headers', EXPOSE_HEADERS);
  }
  return headers;
}

function merge(target: Headers, extra?: Headers): Headers {
  extra?.forEach((value, name) => {
    target.set(name, value);
  });
  return target;
}

function problem(
  status: number,
  title: string,
  origin: string | null,
  extra?: Headers,
  fields: Record<string, unknown> = {}
): Response {
  const headers = merge(baseHeaders(origin), extra);
  headers.set('content-type', 'application/problem+json');
  return new Response(JSON.stringify({ type: 'about:blank', title, status, ...fields }), {
    status,
    headers,
  });
}

function json(body: unknown, status: number, origin: string | null, extra?: Headers): Response {
  const headers = merge(baseHeaders(origin), extra);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

const rpcError = (code: number, message: string) => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message },
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A JSON-RPC response sent by the client (no method, an id, a result or error). */
function isClientResponse(message: unknown): boolean {
  return (
    isObject(message) &&
    message.jsonrpc === '2.0' &&
    !('method' in message) &&
    'id' in message &&
    ('result' in message || 'error' in message)
  );
}

function acceptsJson(accept: string | null): boolean {
  if (!accept || accept.trim() === '') return true;
  const value = accept.toLowerCase();
  return (
    value.includes('application/json') || value.includes('*/*') || value.includes('application/*')
  );
}

/** The closed label a counter carries for one message. */
function operationLabel(message: unknown, known: ReadonlySet<string>): string {
  if (!isObject(message) || typeof message.method !== 'string') return 'unknown';
  if (message.method === 'tools/call') {
    const name = isObject(message.params) ? message.params.name : undefined;
    return typeof name === 'string' && known.has(name) ? name : 'unknown';
  }
  return KNOWN_METHODS.has(message.method) ? message.method : 'unknown';
}

/** Run one message under the time guard; a client response or notification yields nothing. */
async function runGuarded(
  message: unknown,
  deps: McpEndpointDeps,
  protocolVersion: string | undefined
): Promise<unknown> {
  if (isClientResponse(message)) return undefined;
  const timeoutMs = deps.timeoutMs ?? MCP_CALL_TIMEOUT_MS;
  const id =
    isObject(message) && (typeof message.id === 'string' || typeof message.id === 'number')
      ? message.id
      : null;
  const notification = isObject(message) && !('id' in message);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const outcome = await Promise.race([
      deps.handler(message, protocolVersion ? { protocolVersion } : {}),
      timeout,
    ]);
    if (outcome !== 'timeout') return outcome;
    if (notification) return undefined;
    if (isObject(message) && message.method === 'tools/call') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `The call ran past the endpoint's ${timeoutMs} ms guard.`,
                code: 'timeout',
              }),
            },
          ],
          isError: true,
        },
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: `Request timed out after ${timeoutMs} ms.` },
    };
  } catch {
    return notification
      ? undefined
      : { jsonrpc: '2.0', id, error: { code: -32603, message: 'Internal error' } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Handle one HTTP request to `/mcp` or `/.well-known/mcp`. Returns the
 * response and, when the request reached the handler, the counter the
 * caller may send (operation label, status, duration; never request data).
 */
export async function handleMcpHttp(
  request: Request,
  deps: McpEndpointDeps
): Promise<McpHttpResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const method = request.method.toUpperCase();

  // Host first: a rebound DNS name never gets an answer from the handler.
  const urlHost = new URL(request.url).hostname;
  const hostHeader = request.headers.get('host');
  const headerHost = hostHeader === null ? urlHost : hostnameOf(hostHeader);
  if (!isAllowedHost(urlHost) || headerHost === null || !isAllowedHost(headerHost)) {
    return { response: problem(403, 'Host not allowed', null) };
  }

  const origin = request.headers.get('origin');
  if (origin !== null && !isAllowedOrigin(origin)) {
    return { response: problem(403, 'Origin not allowed', null) };
  }
  const cors = origin;

  if (method === 'OPTIONS') {
    const headers = baseHeaders(cors);
    headers.set('allow', ALLOW);
    if (cors) {
      headers.set('access-control-allow-methods', ALLOW);
      headers.set('access-control-allow-headers', ALLOW_HEADERS);
      headers.set('access-control-max-age', '600');
    }
    return { response: new Response(null, { status: 204, headers }) };
  }

  if (method !== 'POST') {
    const allow = new Headers({
      allow: ALLOW,
      link: `<${MCP_SERVER_CARD_PATH}>; rel="describedby"`,
    });
    const agent = isAgentRequest(request.headers.get('user-agent'));
    if (method === 'GET' && agent && deps.serverCard !== undefined) {
      return { response: json(deps.serverCard, 405, cors, allow) };
    }
    return {
      response: problem(405, 'Method Not Allowed', cors, allow, {
        detail:
          'This MCP endpoint speaks stateless Streamable HTTP: POST JSON-RPC with Content-Type application/json. It opens no SSE stream and keeps no session.',
        docs: MCP_DOCS_URL,
        serverCard: MCP_SERVER_CARD_PATH,
      }),
    };
  }

  const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const first = deps.limiter.take(clientKey, 1, started);
  let limits = rateLimitHeaders(deps.limiter.policy, first);
  if (!first.allowed) return { response: problem(429, 'Too Many Requests', cors, limits) };

  if (!isJsonContentType(request.headers.get('content-type'))) {
    return { response: problem(415, 'Unsupported Media Type', cors, limits) };
  }
  if (!acceptsJson(request.headers.get('accept'))) {
    return { response: problem(406, 'Not Acceptable', cors, limits) };
  }
  const protocolVersion = request.headers.get('mcp-protocol-version') ?? undefined;
  if (protocolVersion !== undefined && !deps.supportedVersions.includes(protocolVersion)) {
    return {
      response: json(
        rpcError(
          -32600,
          `Unsupported MCP-Protocol-Version; supported: ${deps.supportedVersions.join(', ')}.`
        ),
        400,
        cors,
        limits
      ),
    };
  }

  const bytes = await readBoundedBody(request, MCP_BODY_MAX);
  if (!bytes) {
    return {
      response: problem(413, 'Content Too Large', cors, limits, {
        detail: `The request body is limited to ${MCP_BODY_MAX} bytes.`,
      }),
    };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { response: json(rpcError(-32700, 'Parse error'), 400, cors, limits) };
  }

  const finish = (response: Response, operation: string): McpHttpResult => ({
    response,
    counter: { operation, status: response.status, durationMs: Math.max(0, now() - started) },
  });

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return {
        response: json(rpcError(-32600, 'Invalid Request: empty batch'), 400, cors, limits),
      };
    }
    if (payload.length > MCP_BATCH_MAX) {
      return {
        response: json(
          rpcError(-32600, `Invalid Request: a batch carries at most ${MCP_BATCH_MAX} messages.`),
          400,
          cors,
          limits
        ),
      };
    }
    // A batch costs one token per message; the first was taken above.
    if (payload.length > 1) {
      const rest = deps.limiter.take(clientKey, payload.length - 1, started);
      limits = rateLimitHeaders(deps.limiter.policy, rest);
      if (!rest.allowed) return { response: problem(429, 'Too Many Requests', cors, limits) };
    }
    const answers = await Promise.all(
      payload.map((message) => runGuarded(message, deps, protocolVersion))
    );
    const responses = answers.filter((answer) => answer !== undefined);
    const response =
      responses.length === 0
        ? new Response(null, { status: 202, headers: merge(baseHeaders(cors), limits) })
        : json(responses, 200, cors, limits);
    return finish(response, 'batch');
  }

  if (!isObject(payload)) {
    return { response: json(rpcError(-32600, 'Invalid Request'), 400, cors, limits) };
  }
  const answer = await runGuarded(payload, deps, protocolVersion);
  const response =
    answer === undefined
      ? new Response(null, { status: 202, headers: merge(baseHeaders(cors), limits) })
      : json(answer, 200, cors, limits);
  return finish(response, operationLabel(payload, deps.knownOperations));
}
