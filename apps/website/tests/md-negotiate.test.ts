// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware.ts';
import { negotiateTwin } from '../src/lib/md-negotiate.ts';

describe('negotiateTwin', () => {
  it.each([
    ['/guides/theming/', 'text/markdown', '/guides/theming.md'],
    ['/guides/theming/', 'text/html, text/markdown;q=0.9', '/guides/theming.md'],
    ['/component-pages/button/', ' text/markdown ;q=0.8', '/component-pages/button.md'],
    ['/primitives-page/accordion/', 'text/markdown', '/primitives-page/accordion.md'],
    ['/skill/', 'text/markdown', '/skill.md'],
  ])('negotiates %s with %s', (pathname, accept, twin) => {
    const decision = negotiateTwin(pathname, accept);
    expect(decision?.twin).toBe(twin);
    expect(decision?.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(decision?.headers.vary).toBe('Accept');
    expect(decision?.headers['x-content-negotiation']).toBe('markdown');
  });

  it.each([
    ['/', 'text/markdown'],
    ['/guides/theming/', 'text/html'],
    ['/guides/theming/', '*/*'],
    ['/guides/theming/', null],
    ['/guides/theming/', ''],
    ['/guides/theming.md', 'text/markdown'],
    ['/examples/', 'text/markdown'],
  ])('passes through %s with %s', (pathname, accept) => {
    expect(negotiateTwin(pathname, accept)).toBeNull();
  });
});

/** A context stub over an in-memory asset map, recording asset fetches. */
function makeContext(
  pathname: string,
  accept: string | null,
  assets: Record<string, number>,
  userAgent: string | null = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36'
) {
  const fetches: string[] = [];
  const next = vi.fn(async () => {
    if (assets['*404*'] !== undefined)
      return new Response('<!doctype html><html lang="en"><body>404</body></html>', {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    return new Response('<!doctype html><html lang="en"><body>page</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  });
  const context = {
    request: new Request(`https://texuli.com${pathname}`, {
      headers: new Headers({
        ...(accept === null ? {} : { accept }),
        ...(userAgent === null ? {} : { 'user-agent': userAgent }),
      }),
    }),
    next,
    env: {
      ASSETS: {
        fetch: async (request: Request) => {
          const bytes = assets[new URL(request.url).pathname];
          fetches.push(new URL(request.url).pathname);
          return bytes === undefined
            ? new Response('not found', { status: 404 })
            : new Response('# Twin\n'.repeat(bytes), { status: 200 });
        },
      },
    },
  };
  return { context, next, fetches };
}

describe('the middleware wrapper', () => {
  it('serves the twin with the negotiation headers', async () => {
    const { context, next, fetches } = makeContext('/guides/theming/', 'text/markdown', {
      '/guides/theming.md': 3,
    });
    const response = await onRequest(context);
    expect(next).not.toHaveBeenCalled();
    expect(fetches).toEqual(['/guides/theming.md']);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('vary')).toBe('Accept');
    expect(response.headers.get('x-content-negotiation')).toBe('markdown');
    expect(await response.text()).toBe('# Twin\n# Twin\n# Twin\n');
  });

  it('passes browsers through and never fetches an asset', async () => {
    const { context, next, fetches } = makeContext('/guides/theming/', 'text/html', {});
    const response = await onRequest(context);
    expect(next).toHaveBeenCalledTimes(1);
    expect(fetches).toEqual([]);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('x-content-negotiation')).toBeNull();
  });

  it('falls through to the pipeline when the twin was not built', async () => {
    const { context, next, fetches } = makeContext('/guides/theming/', 'text/markdown', {});
    const response = await onRequest(context);
    expect(fetches).toEqual(['/guides/theming.md']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('never negotiates the root, even for agents', async () => {
    const { context, next, fetches } = makeContext('/', 'text/markdown', { '/.md': 1 });
    await onRequest(context);
    expect(next).toHaveBeenCalledTimes(1);
    expect(fetches).toEqual([]);
  });
});

describe('the middleware agent 404 (T-27)', () => {
  it('returns problem+json to an agent that misses', async () => {
    const { context } = makeContext(
      '/no/such/page/',
      'text/html',
      { '*404*': 1 },
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'
    );
    const response = await onRequest(context);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    const problem = (await response.json()) as Record<string, unknown>;
    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Not found',
      status: 404,
      instance: '/no/such/page/',
      guide: 'https://texuli.com/llms.txt',
    });
  });

  it('keeps the HTML 404 for humans and Lighthouse', async () => {
    for (const userAgent of [
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse',
    ]) {
      const { context } = makeContext('/no/such/page/', 'text/html', { '*404*': 1 }, userAgent);
      const response = await onRequest(context);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await response.text()).toContain('404');
    }
  });

  it('does not shape successful responses, whatever the agent', async () => {
    const { context } = makeContext(
      '/guides/theming/',
      'text/html',
      {},
      'GPTBot/1.0 (+https://openai.com/gptbot)'
    );
    const response = await onRequest(context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
});
