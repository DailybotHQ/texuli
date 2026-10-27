// @vitest-environment node
/**
 * Umami proxy units (T-36): the pure filter's table of allowed shapes,
 * the path normalizer, cache-control, problem+json bodies, and the route
 * handler end to end with a stubbed fetch (env provisioning, 503 off
 * state, header forwarding, reject rendering). The live wrangler smoke
 * against the built site is T-39's spec.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decideUmamiProxy,
  getUmamiProxyCacheControl,
  resolveUmamiProxyPath,
  umamiProxyProblem,
} from '../src/lib/umami-proxy-filter.ts';

// Literal bracketed filename — the Pages catch-all route convention.
const route = await import('../../../functions/api/umami/[[path]].ts');

describe('the pure filter', () => {
  it('forwards exactly GET script.js and POST api/send; everything else is 404 or 405', () => {
    expect(decideUmamiProxy('script.js', 'GET')).toEqual({
      action: 'forward',
      upstreamPath: 'script.js',
      method: 'GET',
    });
    expect(decideUmamiProxy('api/send', 'POST')).toEqual({
      action: 'forward',
      upstreamPath: 'api/send',
      method: 'POST',
    });
    for (const [path, method, allow] of [
      ['script.js', 'POST', 'GET'],
      ['script.js', 'HEAD', 'GET'],
      ['api/send', 'GET', 'POST'],
      ['api/send', 'PUT', 'POST'],
      ['api/send', 'DELETE', 'POST'],
    ]) {
      expect(decideUmamiProxy(path, method), `${method} ${path}`).toEqual({
        action: 'reject',
        status: 405,
        title: 'Method Not Allowed',
        allow,
      });
    }
    for (const path of ['', '../env', 'script.js/x', 'api/send/extra', '%2e%2e%2fenv', 'api']) {
      expect(decideUmamiProxy(path, 'GET'), path).toEqual({
        action: 'reject',
        status: 404,
        title: 'Not Found',
      });
    }
    expect(decideUmamiProxy('API/SEND', 'POST')).toEqual({
      action: 'reject',
      status: 404,
      title: 'Not Found',
    });
  });

  it('normalizes the catch-all path, sets cache-control and renders RFC 9457 bodies', () => {
    for (const [raw, expected] of [
      [undefined, ''],
      ['script.js', 'script.js'],
      ['/script.js', 'script.js'],
      [['api', 'send'], 'api/send'],
      [['/api/', 'send/'], 'api/send'],
    ] as const) {
      expect(resolveUmamiProxyPath(raw as string | string[] | undefined), String(raw)).toBe(
        expected
      );
    }
    expect(getUmamiProxyCacheControl('script.js')).toContain('max-age=86400');
    expect(getUmamiProxyCacheControl('api/send')).toBe('no-store');
    expect(umamiProxyProblem(404, 'Not Found')).toBe(
      '{"type":"about:blank","title":"Not Found","status":404}'
    );
  });
});

describe('the route handler (functions/api/umami/[[path]].ts)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ctx = (path: string | undefined, method: string, env: Record<string, string>) => ({
    request: new Request(`https://texuli.com/api/umami${path ? `/${path}` : ''}`, { method }),
    params: { path: path?.split('/') },
    env,
  });

  it('is a deliberate 503 off state without the endpoint env', async () => {
    const response = await route.onRequest(ctx('script.js', 'GET', {}));
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.text()).toContain('not provisioned');
  });

  it('forwards script.js to the provisioned origin, same method, no query', async () => {
    const fetchStub = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response('/* umami */', {
          status: 200,
          headers: { 'content-type': 'application/javascript' },
        })
    );
    vi.stubGlobal('fetch', fetchStub);
    const response = await route.onRequest(
      ctx('script.js', 'GET', { UMAMI_ENDPOINT_ORIGIN: 'https://cloud.example.com/' })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
    const [url, init] = fetchStub.mock.calls[0];
    expect(String(url)).toBe('https://cloud.example.com/script.js');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('forwards api/send POST bodies with only the allowlisted headers', async () => {
    const fetchStub = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchStub);
    const request = new Request('https://texuli.com/api/umami/api/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'session=secret',
        authorization: 'Bearer x',
        'cf-connecting-ip': '203.0.113.7',
        'user-agent': 'Mozilla/5.0 Chrome/131',
      },
      body: '{"type":"event"}',
    });
    const response = await route.onRequest({
      request,
      params: { path: ['api', 'send'] },
      env: { UMAMI_ENDPOINT_ORIGIN: 'https://cloud.example.com' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, init] = fetchStub.mock.calls[0];
    expect(String(url)).toBe('https://cloud.example.com/api/send');
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
    expect(headers.get('user-agent')).toBe('Mozilla/5.0 Chrome/131');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
  });

  it('renders 404 problem+json for non-allowlisted paths and 405 with Allow for wrong methods', async () => {
    const env = { UMAMI_ENDPOINT_ORIGIN: 'https://cloud.example.com' };
    const notFound = await route.onRequest(ctx('../env', 'GET', env));
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get('content-type')).toBe('application/problem+json');
    const wrongMethod = await route.onRequest(ctx('script.js', 'POST', env));
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('GET');
  });

  const ORIGIN_ENV = { UMAMI_ENDPOINT_ORIGIN: 'https://cloud.example.com' };

  function sendRequest(body: BodyInit, headers: Record<string, string> = {}): Request {
    return new Request('https://texuli.com/api/umami/api/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    });
  }

  it('caps api/send bodies at 16 KB, declared or not, without forwarding an oversized one', async () => {
    const fetchStub = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchStub);
    const send = (request: Request) =>
      route.onRequest({ request, params: { path: ['api', 'send'] }, env: ORIGIN_ENV });

    const declared = await send(sendRequest('{}', { 'content-length': String(16 * 1024 + 1) }));
    expect(declared.status).toBe(413);
    expect(declared.headers.get('content-type')).toBe('application/problem+json');

    const undeclared = sendRequest(`{"pad":"${'x'.repeat(16 * 1024)}"}`);
    expect(undeclared.headers.get('content-length')).toBeNull();
    expect((await send(undeclared)).status).toBe(413);
    expect(fetchStub).not.toHaveBeenCalled();

    expect((await send(sendRequest('x'.repeat(16 * 1024)))).status).toBe(200);
    const [, init] = fetchStub.mock.calls[0];
    expect(((init as RequestInit).body as ArrayBuffer).byteLength).toBe(16 * 1024);
  });

  it('requires application/json on api/send (415 otherwise)', async () => {
    const fetchStub = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchStub);
    const response = await route.onRequest({
      request: sendRequest('{}', { 'content-type': 'text/plain' }),
      params: { path: ['api', 'send'] },
      env: ORIGIN_ENV,
    });
    expect(response.status).toBe(415);
    expect(fetchStub).not.toHaveBeenCalled();
    const ok = await route.onRequest({
      request: sendRequest('{}', { 'content-type': 'application/json; charset=utf-8' }),
      params: { path: ['api', 'send'] },
      env: ORIGIN_ENV,
    });
    expect(ok.status).toBe(200);
  });

  it('never follows or relays upstream redirects and failures: each becomes the 503 problem', async () => {
    const fetchStub = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchStub);
    await route.onRequest(ctx('script.js', 'GET', ORIGIN_ENV));
    expect((fetchStub.mock.calls[0][1] as RequestInit).redirect).toBe('manual');

    for (const [status, headers] of [
      [301, { location: 'https://attacker.example/script.js' }],
      [302, { location: '/elsewhere' }],
      [404, {}],
      [500, {}],
    ] as const) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('upstream body', { status, headers }))
      );
      const response = await route.onRequest(ctx('script.js', 'GET', ORIGIN_ENV));
      expect(response.status, `upstream ${status}`).toBe(503);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(response.headers.get('location')).toBeNull();
      expect(await response.text()).not.toContain('upstream body');
    }

    const opaque = { status: 0, ok: false, body: null, headers: new Headers() } as Response;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => opaque)
    );
    expect((await route.onRequest(ctx('script.js', 'GET', ORIGIN_ENV))).status).toBe(503);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      })
    );
    const unreachable = await route.onRequest(ctx('script.js', 'GET', ORIGIN_ENV));
    expect(unreachable.status).toBe(503);
    expect(await unreachable.text()).toContain('unreachable');
  });
});
