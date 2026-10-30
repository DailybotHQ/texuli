/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';
import { parseTwinHeader } from '../../apps/website/src/components/docs/twins.ts';
import { onRequest } from '../../functions/_middleware.ts';
import { DIST } from './support/site.ts';

/*
 * Markdown twins on the built site (`pnpm build` first; PLAN_011
 * T-ar-twins). A local static server cannot run Cloudflare Pages
 * Functions, so this spec runs the real middleware (`functions/_middleware.ts`)
 * in front of `dist`: every request goes through `onRequest`, whose
 * `next()` and `env.ASSETS` read the built files with the exact-path
 * `_headers` rules applied (as site-agent-discovery.spec.ts does). That
 * proves the twins, their header blocks and Accept negotiation on the
 * real build; Cloudflare's own runtime is checked only after a deploy.
 */

const SITE = 'https://texuli.com';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** `_headers` → exact path → header lines. */
function headerRules(): Map<string, [string, string][]> {
  const rules = new Map<string, [string, string][]>();
  let path: string | undefined;
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) path = undefined;
    else if (!line.startsWith(' ')) {
      path = line.trim();
      rules.set(path, []);
    } else if (path) {
      const colon = line.indexOf(':');
      rules.get(path)?.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
    }
  }
  return rules;
}

let rules = new Map<string, [string, string][]>();

/** The static host: a built file with its rule's headers, or 404.html. */
function asset(request: Request): Response {
  const path = decodeURIComponent(new URL(request.url).pathname);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file))
    return new Response(readFileSync(join(DIST, '404.html')), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  // Pages' guess for `.md` is not assumed: the middleware must label it.
  const headers = new Headers({
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  for (const [name, value] of rules.get(path) ?? []) headers.set(name, value);
  return new Response(readFileSync(file), { status: 200, headers });
}

let server: Server | undefined;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.md'))) throw new Error('Run `pnpm build` before this spec.');
  rules = headerRules();
  server = createServer(async (incoming, outgoing) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (typeof value === 'string') headers.set(name, value);
    const request = new Request(`${SITE}${incoming.url ?? '/'}`, { headers });
    const response = await onRequest({
      request,
      next: async () => asset(request),
      env: { ASSETS: { fetch: async (assetRequest: Request) => asset(assetRequest) } },
    });
    const out: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      out[name] = value;
    });
    outgoing.writeHead(response.status, out);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(
  () =>
    new Promise<void>((done) => {
      if (!server) return done();
      server.close(() => done());
    })
);

const fetchPath = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${origin}${path}`, { headers });

async function expectTwin(response: Response, route: string, twin: string) {
  expect(response.status, route).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const parsed = parseTwinHeader(await response.text());
  expect(parsed.ok ? [] : parsed.problems, route).toEqual([]);
  if (!parsed.ok) return;
  expect(parsed.header.language).toBe('en');
  expect(parsed.header.canonical).toBe(`${SITE}${route}`);
  expect(parsed.header.markdown).toContain(`${SITE}${twin}`);
  expect(parsed.header.markdown).toContain('`Accept: text/markdown`');
  expect(parsed.header.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  return parsed.header;
}

test('the home page and two non-docs pages have a Markdown twin with the header block', async () => {
  const home = await expectTwin(await fetchPath('/index.md'), '/', '/index.md');
  expect(home?.body).toContain('## For agents');
  expect(home?.body).toContain(`${SITE}/mcp`);
  const studio = await expectTwin(
    await fetchPath('/theme-studio.md'),
    '/theme-studio/',
    '/theme-studio.md'
  );
  expect(studio?.body).toContain('`theme.search`');
  const kanban = await expectTwin(
    await fetchPath('/showcase/kanban.md'),
    '/showcase/kanban/',
    '/showcase/kanban.md'
  );
  expect(kanban?.title).toBe('Kanban');
  // A docs twin keeps its content and gains the header block.
  const theming = await expectTwin(
    await fetchPath('/guides/theming.md'),
    '/guides/theming/',
    '/guides/theming.md'
  );
  expect(theming?.body).toContain('## CSS layers');
});

test('Accept: text/markdown negotiates the root and a non-docs page, with Vary', async () => {
  for (const [route, twin] of [
    ['/', '/index.md'],
    ['/theme-studio/', '/theme-studio.md'],
    ['/examples/blocks-code/', '/examples/blocks-code.md'],
  ] as const) {
    const response = await fetchPath(route, {
      accept: 'text/markdown',
      'user-agent': 'curl/8.4.0',
    });
    expect(response.headers.get('vary')).toBe('Accept');
    expect(response.headers.get('x-content-negotiation')).toBe('markdown');
    await expectTwin(response, route, twin);
  }
  // A browser Accept gets the HTML page, which also declares Vary and links its twin.
  const html = await fetchPath('/', {
    accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  });
  expect(html.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(html.headers.get('vary')).toBe('Accept');
  expect(html.headers.get('link')).toContain('</index.md>; rel="alternate"; type="text/markdown"');
  expect(await html.text()).toContain(
    '<link rel="alternate" type="text/markdown" href="/index.md">'
  );
});

test('every page head links its twin, and the browser sees it', async ({ page }) => {
  await page.goto(`${origin}/theme-studio/`);
  await expect(page.locator('head link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    'href',
    '/theme-studio.md'
  );
  const twin = await page.request.get(`${origin}/theme-studio.md`);
  expect(twin.headers()['content-type']).toBe('text/markdown; charset=utf-8');
});

test('a non-browser miss gets a Markdown 404; /api/ and JSON clients keep problem+json', async () => {
  const miss = await fetchPath('/no/such/page/', { 'user-agent': 'curl/8.4.0' });
  expect(miss.status).toBe(404);
  expect(miss.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await miss.text();
  expect(body).toMatch(/^# Not found\n/);
  expect(body).toContain(`${SITE}/index.md`);

  const api = await fetchPath('/api/no-such', { 'user-agent': 'curl/8.4.0' });
  expect(api.status).toBe(404);
  expect(api.headers.get('content-type')).toBe('application/problem+json');

  const json = await fetchPath('/no/such/page/', {
    'user-agent': 'curl/8.4.0',
    accept: 'application/json',
  });
  expect(json.headers.get('content-type')).toBe('application/problem+json');

  const browser = await fetchPath('/no/such/page/', {
    accept: 'text/html',
    'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  });
  expect(browser.status).toBe(404);
  expect(browser.headers.get('content-type')).toBe('text/html; charset=utf-8');
});
