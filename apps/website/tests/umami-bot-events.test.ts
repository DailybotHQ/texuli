// @vitest-environment node
/**
 * Server-side bot and markdown event units (T-37): the UA-class table,
 * the event decision table, the payload shape (UA-class + path only, off
 * when unprovisioned), the request shape, and the middleware wiring end
 * to end with stubbed fetch and a collecting waitUntil.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware.ts';
import {
  botEventFor,
  buildBotEventBody,
  buildBotEventRequest,
  classifyBotUa,
} from '../src/lib/bot-events.ts';

describe('classifyBotUa', () => {
  it.each([
    ['GPTBot/1.0 (+https://openai.com/gptbot)', 'ai_bot'],
    ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'ai_bot'],
    ['Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', 'ai_bot'],
    ['Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)', 'ai_bot'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'plain_agent'],
    ['curl/8.4.0', 'plain_agent'],
    ['python-requests/2.31.0', 'plain_agent'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
      'audit_tool',
    ],
    ['Mozilla/5.0 Lighthouse/12 (audit)', 'audit_tool'],
    ['SiteMonitor 3.0 (uptime watcher)', 'unknown_bot'],
    ['SomeFetcher/1.0', 'unknown_bot'],
    ['Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36', 'human'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1',
      'human',
    ],
  ])('classifies %j as %s', (userAgent, expected) => {
    expect(classifyBotUa(userAgent)).toBe(expected);
  });

  it('treats a missing user agent as human', () => {
    expect(classifyBotUa(undefined)).toBe('human');
    expect(classifyBotUa(null)).toBe('human');
    expect(classifyBotUa('')).toBe('human');
  });
});

describe('botEventFor', () => {
  it('counts a served markdown twin whatever fetched it', () => {
    expect(botEventFor('Mozilla/5.0 Chrome/131', true)).toBe('markdown_request');
    expect(botEventFor('curl/8.4.0', true)).toBe('markdown_request');
  });

  it('counts known AI bots and unknown bots on page hits only', () => {
    expect(botEventFor('GPTBot/1.0', false)).toBe('ai_bot_visit');
    expect(botEventFor('SiteMonitor 3.0', false)).toBe('unknown_bot_visit');
  });

  it('counts nothing for plain agents, audit tools and humans', () => {
    expect(botEventFor('curl/8.4.0', false)).toBeNull();
    expect(botEventFor('Mozilla/5.0 Lighthouse/12', false)).toBeNull();
    expect(botEventFor('Mozilla/5.0 Chrome/131', false)).toBeNull();
    expect(botEventFor(undefined, false)).toBeNull();
  });
});

describe('buildBotEventBody', () => {
  it('is null when analytics is not provisioned (the server-side off state)', () => {
    expect(buildBotEventBody('ai_bot_visit', '/guides/', undefined, 'texuli.com')).toBeNull();
    expect(buildBotEventBody('ai_bot_visit', '/guides/', '', 'texuli.com')).toBeNull();
  });

  it('carries UA-class and path only — never a raw UA, IP or referrer', () => {
    const body = buildBotEventBody('ai_bot_visit', '/guides/theming/', 'site-id', 'texuli.com');
    expect(body).not.toBeNull();
    const parsed = JSON.parse(body as string);
    expect(parsed).toEqual({
      type: 'event',
      payload: {
        website: 'site-id',
        name: 'ai_bot_visit',
        hostname: 'texuli.com',
        data: { path: '/guides/theming/' },
        userAgent: 'bot',
      },
    });
    expect(body).not.toContain('GPTBot');
    expect(body).not.toContain('Mozilla');
  });

  it('marks markdown twins distinctly from bot visits', () => {
    const parsed = JSON.parse(
      buildBotEventBody('markdown_request', '/guides/', 'site-id', 'texuli.com') as string
    );
    expect(parsed.payload.userAgent).toBe('markdown-client');
  });
});

describe('buildBotEventRequest', () => {
  it('POSTs the body to the same-origin proxy path', () => {
    const request = buildBotEventRequest('{"x":1}', 'https://texuli.com');
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://texuli.com/api/umami/api/send');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.get('user-agent')).toBe('texuli-edge/1.0 (server-side event)');
  });
});

describe('the middleware wiring (functions/_middleware.ts)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  interface SentRequest {
    url: string;
    init: RequestInit;
  }

  async function run(opts: {
    userAgent?: string;
    path?: string;
    accept?: string;
    env: Record<string, string | undefined>;
    next?: () => Promise<Response>;
    assets?: () => Promise<Response>;
  }): Promise<{ sent: SentRequest[]; waited: Promise<unknown>[]; response: Response }> {
    const sent: SentRequest[] = [];
    const waited: Promise<unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        // The middleware sends a single Request object; normalize both
        // call forms so assertions see url/method/headers/body alike.
        if (typeof input === 'string' || input instanceof URL) {
          sent.push({ url: String(input), init: init ?? {} });
        } else {
          const body = await input.text();
          sent.push({
            url: input.url,
            init: { method: input.method, headers: input.headers, body },
          });
        }
        return new Response('{}', { status: 200 });
      })
    );
    const url = `https://texuli.com${opts.path ?? '/guides/theming/'}`;
    const response = await onRequest({
      request: new Request(url, {
        headers: {
          ...(opts.userAgent ? { 'user-agent': opts.userAgent } : {}),
          ...(opts.accept ? { accept: opts.accept } : {}),
        },
      }),
      next:
        opts.next ??
        (async () =>
          new Response('<!doctype html><html></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })),
      env: {
        ASSETS: { fetch: opts.assets ?? (async () => new Response('missing', { status: 404 })) },
        ...opts.env,
      },
      waitUntil: (promise) => {
        waited.push(promise);
      },
    });
    // Drain the queued sends: the stub reads Request bodies async, so the
    // captured sends only exist once those promises settle.
    await Promise.all(waited);
    return { sent, waited, response };
  }

  it('sends ai_bot_visit for a bot page hit, through the proxy, via waitUntil', async () => {
    const { sent, waited, response } = await run({
      userAgent: 'GPTBot/1.0',
      env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' },
    });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://texuli.com/api/umami/api/send');
    expect(sent[0].init.method).toBe('POST');
    expect(String(sent[0].init.body)).toContain('"name":"ai_bot_visit"');
    expect(waited).toHaveLength(1);
  });

  it('sends nothing when the website id is not provisioned', async () => {
    const { sent } = await run({ userAgent: 'GPTBot/1.0', env: {} });
    expect(sent).toHaveLength(0);
  });

  it('sends nothing for human, plain-agent or audit page hits', async () => {
    for (const userAgent of [
      'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36',
      'curl/8.4.0',
      'Mozilla/5.0 (X11) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
    ]) {
      const { sent } = await run({ userAgent, env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' } });
      expect(sent).toHaveLength(0);
    }
  });

  it('sends markdown_request when a twin is served', async () => {
    const { sent } = await run({
      userAgent: 'curl/8.4.0',
      accept: 'text/markdown',
      env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' },
      assets: async () => new Response('# Theming\n', { status: 200 }),
    });
    expect(sent).toHaveLength(1);
    expect(String(sent[0].init.body)).toContain('"name":"markdown_request"');
    // The middleware's own UA header is the class, never the original.
    const headers = sent[0].init.headers as Headers;
    expect(headers.get('user-agent')).toBe('texuli-edge/1.0 (server-side event)');
  });

  it('sends nothing when a twin was requested but none was built', async () => {
    const { sent } = await run({
      userAgent: 'curl/8.4.0',
      accept: 'text/markdown',
      env: { PUBLIC_UMAMI_WEBSITE_ID: 'site-id' },
      assets: async () => new Response('missing', { status: 404 }),
    });
    expect(sent).toHaveLength(0);
  });
});
