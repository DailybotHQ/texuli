// @vitest-environment node
/**
 * The remote MCP endpoint (T-mcp-remote, ADR-018): `functions/mcp.ts` for
 * `/mcp`, the middleware route for `/.well-known/mcp`, and the pure HTTP
 * envelope in `functions/_lib/mcp-endpoint.ts`. Every test drives the real
 * handler with real `Request` objects: the protocol happy paths (edge
 * operations only), every limit (body, batch, per-operation caps, the time
 * guard, the token bucket), hostile JSON, Origin and Host checks, CORS, the
 * security headers and the counters-only events.
 */
import { texuliOps } from '@texuli/tools/ops';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenBucket,
  handleMcpHttp,
  isAllowedHost,
  isAllowedOrigin,
  MCP_BATCH_MAX,
  MCP_BODY_MAX,
  MCP_CALL_TIMEOUT_MS,
  MCP_RATE_POLICY,
  type McpEndpointDeps,
} from '../../../functions/_lib/mcp-endpoint.ts';
import { onRequest as middleware } from '../../../functions/_middleware.ts';
import { onRequest } from '../../../functions/mcp.ts';
import { buildMcpEventBody, mcpDurationBucket } from '../src/lib/bot-events.ts';

const ORIGIN = 'https://texuli.com';
const EDGE_NAMES = texuliOps.list({ runtimes: ['edge'] }).map((operation) => operation.name);
const NODE_NAMES = texuliOps.list({ runtimes: ['node'] }).map((operation) => operation.name);

// Every request gets its own client IP unless a test pins one, so the
// per-isolate bucket (shared module state) never couples two tests.
let ipCounter = 0;
const nextIp = () => `198.51.100.${++ipCounter % 250}`;

interface RequestOptions {
  method?: string;
  url?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  ip?: string;
}

function mcpRequest(options: RequestOptions = {}): Request {
  const method = options.method ?? 'POST';
  return new Request(options.url ?? `${ORIGIN}/mcp`, {
    method,
    headers: {
      ...(method === 'POST'
        ? { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
        : {}),
      'cf-connecting-ip': options.ip ?? nextIp(),
      ...options.headers,
    },
    body: method === 'POST' || method === 'PUT' ? (options.body ?? null) : undefined,
    ...(options.body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);
}

interface CallOptions extends RequestOptions {
  env?: Record<string, string>;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const fakeAssets = { fetch: async () => new Response('missing', { status: 404 }) };

function call(options: CallOptions = {}): Promise<Response> {
  return onRequest({
    request: mcpRequest(options),
    env: { ASSETS: fakeAssets, ...options.env },
    ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}),
  });
}

function rpc(message: unknown, options: CallOptions = {}): Promise<Response> {
  return call({ ...options, body: JSON.stringify(message) });
}

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

function expectSecurityHeaders(response: Response, label: string): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name), `${label}: ${name}`).toBe(value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the protocol through POST /mcp (edge operations only)', () => {
  it('answers initialize with the negotiated version and tools/list with edge operations only', async () => {
    const init = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      },
    });
    expect(init.status).toBe(200);
    expect(init.headers.get('content-type')).toBe('application/json');
    const initBody = await init.json();
    expect(initBody.result.protocolVersion).toBe('2025-06-18');
    expect(initBody.result.serverInfo.name).toBe('texuli');
    expect(init.headers.get('mcp-session-id')).toBeNull();

    const list = await rpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { headers: { 'mcp-protocol-version': '2025-11-25' } }
    );
    expect(list.status).toBe(200);
    const names: string[] = (await list.json()).result.tools.map(
      (tool: { name: string }) => tool.name
    );
    for (const name of EDGE_NAMES) expect(names, name).toContain(name);
    expect(NODE_NAMES.length).toBeGreaterThan(0);
    for (const name of NODE_NAMES) expect(names, name).not.toContain(name);
  });

  it('runs catalog.search and blueprint.validate through tools/call', async () => {
    const search = await rpc(
      {
        jsonrpc: '2.0',
        id: 'a',
        method: 'tools/call',
        params: { name: 'catalog.search', arguments: { query: 'card', limit: 3 } },
      },
      { headers: { 'mcp-protocol-version': '2025-11-25' } }
    );
    expect(search.status).toBe(200);
    const searchBody = await search.json();
    expect(searchBody.id).toBe('a');
    expect(searchBody.result.isError).toBeUndefined();
    expect(searchBody.result.structuredContent.entries.length).toBeGreaterThan(0);

    const examples = texuliOps.get('blueprint.validate')?.examples ?? [];
    expect(examples.length).toBeGreaterThan(1);
    const verdicts: boolean[] = [];
    for (const example of examples) {
      const response = await rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'blueprint.validate', arguments: example.input },
      });
      verdicts.push((await response.json()).result.structuredContent.valid);
    }
    expect(verdicts).toEqual([true, false]);
  });

  it('refuses a node operation as runtime-unavailable and keeps each operation limit', async () => {
    for (const name of NODE_NAMES) {
      const response = await rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: {} },
      });
      const text = (await response.json()).result.content[0].text;
      expect(JSON.parse(text).code, name).toBe('runtime-unavailable');
    }
    // catalog.search declares 4,096 input bytes and at most 100 results.
    const tooLarge = await rpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'catalog.search', arguments: { query: 'x'.repeat(5000) } },
    });
    expect(JSON.parse((await tooLarge.json()).result.content[0].text).code).toBe('input-too-large');
    const tooMany = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'catalog.search', arguments: { limit: 1000 } },
    });
    expect(JSON.parse((await tooMany.json()).result.content[0].text).code).toBe('invalid-input');
  });

  it('reads texuli://catalog through resources/read', async () => {
    const response = await rpc({
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: { uri: 'texuli://catalog' },
    });
    expect(response.status).toBe(200);
    const [contents] = (await response.json()).result.contents;
    expect(contents.uri).toBe('texuli://catalog');
    expect(contents.mimeType).toBe('application/json');
    expect(JSON.parse(contents.text).entries.length).toBeGreaterThan(10);
  });

  it('answers a notification, and a client response, with 202 and no body', async () => {
    for (const message of [
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 9, result: {} },
    ]) {
      const response = await rpc(message);
      expect(response.status, JSON.stringify(message)).toBe(202);
      expect(await response.text()).toBe('');
      expectSecurityHeaders(response, '202');
    }
  });

  it('refuses an unsupported MCP-Protocol-Version header with 400', async () => {
    const response = await rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { headers: { 'mcp-protocol-version': '1999-01-01' } }
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32600);
  });
});

describe('batches', () => {
  it('answers a batch in order, skipping notifications', async () => {
    const response = await rpc([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'component.get', arguments: { id: 'card' } },
      },
      { jsonrpc: '2.0', id: 3, method: 'no/such-method' },
      'not a message',
    ]);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((item: { id: unknown }) => item.id)).toEqual([1, 2, 3, null]);
    expect(body[0].result).toEqual({});
    expect(body[1].result.structuredContent.component.id).toBe('card');
    expect(body[2].error.code).toBe(-32601);
    expect(body[3].error.code).toBe(-32600);
  });

  it(`refuses an empty batch and a batch over ${MCP_BATCH_MAX}; a notifications-only batch is 202`, async () => {
    expect(MCP_BATCH_MAX).toBe(10);
    const empty = await rpc([]);
    expect(empty.status).toBe(400);
    expect((await empty.json()).error.code).toBe(-32600);

    const ping = (id: number) => ({ jsonrpc: '2.0', id, method: 'ping' });
    const atLimit = await rpc(Array.from({ length: MCP_BATCH_MAX }, (_, i) => ping(i)));
    expect(atLimit.status).toBe(200);
    expect(await atLimit.json()).toHaveLength(MCP_BATCH_MAX);

    const over = await rpc(Array.from({ length: MCP_BATCH_MAX + 1 }, (_, i) => ping(i)));
    expect(over.status).toBe(400);
    const overBody = await over.json();
    expect(overBody.error.code).toBe(-32600);
    expect(overBody.error.message).toContain(String(MCP_BATCH_MAX));

    const quiet = await rpc([
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', method: 'notifications/cancelled', params: {} },
    ]);
    expect(quiet.status).toBe(202);
  });
});

describe('hostile and malformed requests', () => {
  it(`refuses a body over ${MCP_BODY_MAX} bytes with 413 problem+json, declared or streamed`, async () => {
    expect(MCP_BODY_MAX).toBe(256 * 1024);
    const big = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
      params: { pad: 'x'.repeat(MCP_BODY_MAX) },
    });
    const declared = await call({ body: big });
    expect(declared.status).toBe(413);
    expect(declared.headers.get('content-type')).toBe('application/problem+json');
    expect((await declared.json()).status).toBe(413);
    expectSecurityHeaders(declared, '413');

    // No content-length: the stream is counted and cancelled at the cap.
    let pulled = 0;
    const chunk = new Uint8Array(64 * 1024).fill(0x20);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled > 100) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const streamed = await call({ body: stream });
    expect(streamed.status).toBe(413);
    expect(pulled).toBeLessThan(10);
  });

  it('answers malformed JSON and invalid UTF-8 with a -32700 parse error', async () => {
    for (const body of ['{"jsonrpc":"2.0",', '', 'nul', new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])]) {
      const response = await call({ body });
      expect(response.status, String(body)).toBe(400);
      expect((await response.json()).error.code).toBe(-32700);
    }
  });

  it('refuses a missing or wrong Content-Type with 415, and an Accept without JSON with 406', async () => {
    for (const contentType of [
      'text/plain',
      'application/x-www-form-urlencoded',
      'application/jsonp',
    ]) {
      const response = await call({
        body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
        headers: { 'content-type': contentType },
      });
      expect(response.status, contentType).toBe(415);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
    }
    const json = await call({
      body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    expect(json.status).toBe(200);
    const notAcceptable = await call({
      body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
      headers: { accept: 'text/html' },
    });
    expect(notAcceptable.status).toBe(406);
  });

  it('survives prototype keys, deep nesting and non-object messages without leaking state', async () => {
    const proto = await call({
      body: '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"catalog.search","arguments":{"__proto__":{"polluted":true}}}}',
    });
    expect(proto.status).toBe(200);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    const deep = await call({ body: `${'['.repeat(100_000)}${']'.repeat(100_000)}` });
    expect([200, 400]).toContain(deep.status);
    const deepBody = await deep.json();
    expect(JSON.stringify(deepBody)).toContain('-32600');

    for (const body of ['42', '"text"', 'null', 'true']) {
      const response = await call({ body });
      expect(response.status, body).toBe(400);
      expect((await response.json()).error.code).toBe(-32600);
    }
  });
});

describe('Origin and Host', () => {
  it('classifies origins and hosts', () => {
    for (const origin of [
      'https://texuli.com',
      'https://texuli.pages.dev',
      'https://feat-mcp.texuli.pages.dev',
      'https://0a1b2c3d.texuli.pages.dev',
      'http://localhost:4321',
      'http://127.0.0.1:4995',
    ])
      expect(isAllowedOrigin(origin), origin).toBe(true);
    for (const origin of [
      'null',
      '',
      'https://evil.example',
      'http://texuli.com',
      'https://texuli.com.evil.example',
      'https://evil-texuli.com',
      'https://a.b.texuli.pages.dev',
      'https://texuli.com/path',
      'https://texuli.com:8443',
      'https://localhost.evil.example',
    ])
      expect(isAllowedOrigin(origin), origin).toBe(false);
    for (const host of [
      'texuli.com',
      'texuli.pages.dev',
      'x1.texuli.pages.dev',
      'localhost',
      '127.0.0.1',
    ])
      expect(isAllowedHost(host), host).toBe(true);
    for (const host of ['evil.example', 'texuli.com.evil.example', 'a.b.texuli.pages.dev', ''])
      expect(isAllowedHost(host), host).toBe(false);
  });

  it('refuses a disallowed Origin with 403 and no CORS grant; allows a missing Origin', async () => {
    const message = { jsonrpc: '2.0', id: 1, method: 'ping' };
    for (const origin of ['https://evil.example', 'null']) {
      const response = await rpc(message, { headers: { origin } });
      expect(response.status, origin).toBe(403);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
      expectSecurityHeaders(response, `403 ${origin}`);
    }
    const allowed = await rpc(message, { headers: { origin: 'https://texuli.com' } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://texuli.com');
    expect(allowed.headers.get('vary')).toContain('Origin');

    const server = await rpc(message);
    expect(server.status).toBe(200);
    expect(server.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('refuses a wrong Host (DNS rebinding) with 403', async () => {
    const message = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const wrongUrl = await call({ url: 'https://evil.example/mcp', body: message });
    expect(wrongUrl.status).toBe(403);
    const wrongHeader = await call({ body: message, headers: { host: 'evil.example' } });
    expect(wrongHeader.status).toBe(403);
    const preview = await call({ url: 'https://feat-x.texuli.pages.dev/mcp', body: message });
    expect(preview.status).toBe(200);
  });
});

describe('the token bucket (per isolate, keyed by CF-Connecting-IP)', () => {
  it(`allows ${MCP_RATE_POLICY.capacity} requests, then 429 with Retry-After and RateLimit headers`, async () => {
    const ip = '203.0.113.77';
    const message = { jsonrpc: '2.0', id: 1, method: 'ping' };
    let last: Response | undefined;
    for (let i = 0; i < MCP_RATE_POLICY.capacity; i++) {
      last = await rpc(message, { ip });
      expect(last.status, `request ${i}`).toBe(200);
    }
    expect(last?.headers.get('ratelimit-policy')).toBe(
      `"mcp";q=${MCP_RATE_POLICY.capacity};w=${MCP_RATE_POLICY.windowSeconds}`
    );
    expect(last?.headers.get('ratelimit')).toMatch(/^"mcp";r=0;t=\d+$/);
    const limited = await rpc(message, { ip });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('content-type')).toBe('application/problem+json');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expectSecurityHeaders(limited, '429');
    // Another client is unaffected.
    expect((await rpc(message, { ip: '203.0.113.78' })).status).toBe(200);
  });

  it('charges a batch per message, refills over time and caps the tracked keys', () => {
    const bucket = createTokenBucket(
      { name: 't', capacity: 10, windowSeconds: 10 },
      { maxKeys: 3 }
    );
    expect(bucket.take('a', 10, 0).allowed).toBe(true);
    const refused = bucket.take('a', 1, 0);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(1);
    expect(bucket.take('a', 1, 1000).allowed).toBe(true);
    expect(bucket.take('a', 4, 5000).allowed).toBe(true);
    for (const key of ['b', 'c', 'd', 'e', 'f']) bucket.take(key, 1, 6000);
    expect(bucket.size()).toBeLessThanOrEqual(3);
  });
});

describe('the time guard', () => {
  it(`ends a call that runs past ${MCP_CALL_TIMEOUT_MS} ms`, async () => {
    expect(MCP_CALL_TIMEOUT_MS).toBe(5000);
    const deps: McpEndpointDeps = {
      handler: () => new Promise(() => undefined),
      supportedVersions: ['2025-11-25'],
      limiter: createTokenBucket(MCP_RATE_POLICY),
      knownOperations: new Set(['catalog.search']),
      timeoutMs: 20,
    };
    const tool = await handleMcpHttp(
      mcpRequest({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'catalog.search', arguments: {} },
        }),
      }),
      deps
    );
    expect(tool.response.status).toBe(200);
    const toolBody = await tool.response.json();
    expect(toolBody.result.isError).toBe(true);
    expect(JSON.parse(toolBody.result.content[0].text).code).toBe('timeout');

    const other = await handleMcpHttp(
      mcpRequest({ body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/list' }) }),
      deps
    );
    expect((await other.response.json()).error.code).toBe(-32603);
  });
});

describe('GET, OPTIONS and other methods', () => {
  it('answers GET with 405, Allow and a docs pointer; agents get the server card', async () => {
    const browser = await call({ method: 'GET' });
    expect(browser.status).toBe(405);
    expect(browser.headers.get('allow')).toBe('POST, OPTIONS');
    expect(browser.headers.get('content-type')).toBe('application/problem+json');
    const problem = await browser.json();
    expect(problem.docs).toMatch(/^https:\/\//);
    expect(problem.serverCard).toBe('/.well-known/mcp/server-card.json');
    expectSecurityHeaders(browser, 'GET');

    const agent = await call({ method: 'GET', headers: { 'user-agent': 'curl/8.4.0' } });
    expect(agent.status).toBe(405);
    expect(agent.headers.get('content-type')).toBe('application/json');
    expect((await agent.json()).serverInfo.name).toBe('texuli');

    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      const response = await call({ method, body: method === 'PUT' ? '{}' : null });
      expect(response.status, method).toBe(405);
    }
  });

  it('answers an allowed preflight with 204 and the CORS grant; a foreign one with 403', async () => {
    const preflight = await call({
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:4321',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, mcp-protocol-version',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'mcp-protocol-version'
    );
    expect(preflight.headers.get('access-control-max-age')).toBe('600');
    expectSecurityHeaders(preflight, 'OPTIONS');

    const foreign = await call({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('security headers', () => {
  it('sets every security header on every kind of answer', async () => {
    const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const answers: [string, Response][] = [
      ['200', await call({ body: ping })],
      ['202', await call({ body: '{"jsonrpc":"2.0","method":"notifications/initialized"}' })],
      ['parse', await call({ body: '{' })],
      ['415', await call({ body: ping, headers: { 'content-type': 'text/plain' } })],
      ['403', await call({ body: ping, headers: { origin: 'https://evil.example' } })],
      ['405', await call({ method: 'GET' })],
      ['204', await call({ method: 'OPTIONS' })],
    ];
    for (const [label, response] of answers) expectSecurityHeaders(response, label);
  });
});

describe('/.well-known/mcp through the middleware', () => {
  it('routes /.well-known/mcp to the same handler and leaves /mcp to the Function', async () => {
    const next = vi.fn(async () => new Response('function', { status: 200 }));
    const response = await middleware({
      request: mcpRequest({
        url: `${ORIGIN}/.well-known/mcp`,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      next,
      env: { ASSETS: fakeAssets },
    });
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expectSecurityHeaders(response, 'well-known');
    expect((await response.json()).result.tools.length).toBe(
      (await (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).json()).result.tools
        .length
    );

    const card = vi.fn(async () => new Response('{}', { status: 200 }));
    await middleware({
      request: new Request(`${ORIGIN}/.well-known/mcp/server-card.json`),
      next: card,
      env: { ASSETS: fakeAssets },
    });
    expect(card).toHaveBeenCalledOnce();

    const fn = vi.fn(async () => new Response('function', { status: 200 }));
    const passed = await middleware({
      request: mcpRequest({ body: '{}', headers: { 'user-agent': 'curl/8.4.0' } }),
      next: fn,
      env: { ASSETS: fakeAssets },
    });
    expect(fn).toHaveBeenCalledOnce();
    expect(await passed.text()).toBe('function');
  });
});

describe('counters only, never request data', () => {
  it('sends one mcp_call event (operation, status, duration bucket) when analytics is provisioned', async () => {
    const sent: { url: string; body: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const request = input as Request;
        sent.push({ url: request.url, body: await request.text() });
        return new Response('{}', { status: 200 });
      })
    );
    const waited: Promise<unknown>[] = [];
    const secret = 'fictional-secret-query-text';
    const response = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'catalog.search', arguments: { query: secret } },
      },
      { env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' }, waitUntil: (promise) => waited.push(promise) }
    );
    expect(response.status).toBe(200);
    await Promise.all(waited);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('https://texuli.com/api/umami/api/send');
    const payload = JSON.parse(sent[0]?.body ?? '{}').payload;
    expect(payload.name).toBe('mcp_call');
    expect(payload.data.operation).toBe('catalog.search');
    expect(payload.data.status).toBe(200);
    expect(['lt10ms', 'lt100ms', 'lt1s', 'lt5s', 'gte5s']).toContain(payload.data.duration);
    expect(sent[0]?.body).not.toContain(secret);
    expect(sent[0]?.body).not.toContain('198.51.100');

    // An unknown tool name is never echoed into the counters.
    sent.length = 0;
    await rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'evil@example.com' } },
      { env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' }, waitUntil: (promise) => waited.push(promise) }
    );
    await Promise.all(waited);
    expect(JSON.parse(sent[0]?.body ?? '{}').payload.data.operation).toBe('unknown');
  });

  it('buckets durations, caps the label and stays off without a website id', () => {
    const table: [number, string][] = [
      [0, 'lt10ms'],
      [9, 'lt10ms'],
      [10, 'lt100ms'],
      [999, 'lt1s'],
      [4999, 'lt5s'],
      [5000, 'gte5s'],
    ];
    for (const [ms, bucket] of table) expect(mcpDurationBucket(ms), String(ms)).toBe(bucket);
    const counter = { operation: 'x'.repeat(500), status: 200, durationMs: 3 };
    expect(buildMcpEventBody(counter, undefined, 'texuli.com')).toBeNull();
    const body = JSON.parse(buildMcpEventBody(counter, 'site-id', 'texuli.com') ?? '{}');
    expect(body.payload.data).toEqual({
      operation: 'x'.repeat(64),
      status: 200,
      duration: 'lt10ms',
    });
    expect(body.payload.userAgent).toBe('mcp-client');
  });

  it('never fetches when analytics is not provisioned', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchSpy);
    const response = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'theme.get', arguments: { id: 'violet' } },
      },
      { waitUntil: () => undefined }
    );
    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
