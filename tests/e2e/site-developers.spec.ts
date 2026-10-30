/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';
import { API_RESOURCES, API_VERSION } from '../../apps/website/src/lib/api-surface.ts';
import { checkOpenApi } from '../../apps/website/src/lib/openapi.ts';
import { onRequest } from '../../functions/_middleware.ts';
import {
  axeViolations,
  DIST,
  expectMode,
  polishProblems,
  serveDist,
  settle,
} from './support/site.ts';

/*
 * texuli.com /developers/ and the JSON API on the built site (`pnpm build`
 * first; PLAN_011 T-ar-api):
 *
 * 1. the portal renders its facts from the typed sources, is axe-clean in
 *    light and dark, and every link on it resolves (built paths through the
 *    real middleware; outside links only to the repository and npm);
 * 2. /openapi.json parses, describes POST /mcp, and passes the structural
 *    check against `dist` (every described path is built);
 * 3. /api/v1/ answers through the real middleware (`functions/_middleware.ts`),
 *    which maps each alias to its source file in `dist` (no alias file is
 *    built), with X-API-Version and the RateLimit fields; a miss is
 *    problem+json; the static API files keep the `_headers` rule.
 *
 * A local server cannot run Cloudflare Pages Functions, so the HTTP checks
 * call `onRequest` in front of `dist`, with the `_headers` rules (exact
 * paths and the `/api/*` splat) applied to the static answers. The page
 * itself is opened from a plain static server (serveDist), as the other
 * site specs do. Generators are unit-tested in
 * apps/website/tests/site-api.test.ts.
 */

const SITE = 'https://texuli.com';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** `_headers` → path pattern → header lines (Cloudflare's grammar). */
function headerRules(): [string, [string, string][]][] {
  const rules: [string, [string, string][]][] = [];
  let lines: [string, string][] | undefined;
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) lines = undefined;
    else if (!line.startsWith(' ')) {
      lines = [];
      rules.push([line.trim(), lines]);
    } else if (lines) {
      const colon = line.indexOf(':');
      lines.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
    }
  }
  return rules;
}

let rules: [string, [string, string][]][] = [];

/** A rule matches its exact path, or every path under a `/dir/*` splat. */
const matches = (pattern: string, path: string) =>
  pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path;

/** The static host: a built file with its rules' headers, or 404.html. */
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
  const headers = new Headers({
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  for (const [pattern, lines] of rules)
    if (matches(pattern, path)) for (const [name, value] of lines) headers.set(name, value);
  return new Response(readFileSync(file), { status: 200, headers });
}

let server: Server | undefined;
let edge = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'openapi.json')))
    throw new Error('Run `pnpm build` before this spec.');
  rules = headerRules();
  server = createServer(async (incoming, outgoing) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (typeof value === 'string') headers.set(name, value);
    const request = new Request(`${SITE}${incoming.url ?? '/'}`, {
      method: incoming.method ?? 'GET',
      headers,
    });
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
  edge = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(
  () =>
    new Promise<void>((done) => {
      if (!server) return done();
      server.close(() => done());
    })
);

const page$ = serveDist();
const viaEdge = (path: string, init?: RequestInit) => fetch(`${edge}${path}`, init);

test('the portal: facts from the typed sources, WebAPI JSON-LD, axe-clean in light, dark and forced colors', async ({
  page,
}) => {
  await page.goto(`${page$()}/developers/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Developers');
  await expect(page.locator('[data-api-version]')).toHaveText(API_VERSION);
  await expect(page.locator('[data-api-status]')).toContainText('In development');
  await expect(page.locator('[data-api-endpoints] tbody tr')).toHaveCount(API_RESOURCES.length);
  const text = await page.locator('main').innerText();
  for (const fact of [
    'https://texuli.com/mcp',
    'npx -y @texuli/mcp',
    '/.well-known/mcp/server-card.json',
    'npx -p @texuli/tools texuli help',
    'texuli catalog search',
    'X-API-Version',
    'RateLimit-Policy',
    'application/problem+json',
    'MIT',
  ])
    expect(text, fact).toContain(fact);
  for (const id of [
    'quick-start',
    'endpoints',
    'mcp',
    'cli',
    'agents',
    'limits',
    'errors',
    'versioning',
    'access',
  ])
    await expect(page.locator(`h2#${id}`)).toHaveCount(1);
  const graphs = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
  expect(graphs.some((graph) => graph.includes('"@type":"WebAPI"'))).toBe(true);
  // Each mode on a fresh load, as the site sweep does (a11y-sweep.ts).
  for (const mode of ['light', 'dark', 'forced-colors'] as const) {
    await page.emulateMedia({
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    await page.goto(`${page$()}/developers/`);
    await settle(page);
    if (mode !== 'forced-colors') await expectMode(page, mode);
    expect(await axeViolations(page), mode).toEqual([]);
    expect(await polishProblems(page), mode).toEqual([]);
  }
});

test('every link on the portal resolves', async ({ page }) => {
  await page.goto(`${page$()}/developers/`);
  const hrefs = await page
    .locator('main a[href]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
  expect(hrefs.length).toBeGreaterThan(15);
  for (const href of hrefs) {
    if (href.startsWith('#')) {
      await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
      continue;
    }
    if (/^https?:/.test(href)) {
      // Outside links: only the repository and npm, over https.
      expect(href, href).toMatch(/^https:\/\/(github\.com\/DailybotHQ\/texuli|www\.npmjs\.com\/)/);
      continue;
    }
    expect(href, href).toMatch(/^\/(?!\/)/);
    const response = await viaEdge(href, { headers: { 'user-agent': 'curl/8.4.0' } });
    expect(response.status, href).toBe(200);
  }
});

test('/openapi.json parses, describes POST /mcp and only built paths', async () => {
  const response = await viaEdge('/openapi.json');
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  const document = (await response.json()) as Record<string, unknown> & {
    info: { version: string };
    paths: Record<string, Record<string, { operationId: string }>>;
  };
  expect(document.openapi).toBe('3.1.0');
  expect(document.info.version).toBe(API_VERSION);
  expect(document.paths['/mcp']?.post?.operationId).toBe('callMcp');
  const themeIds = readdirSync(join(DIST, 'theme-data')).map((name) => name.replace(/\.json$/, ''));
  expect(themeIds.length).toBeGreaterThan(100);
  const problems = checkOpenApi(document, {
    exists: (path) => {
      const file = join(DIST, path.slice(1));
      return existsSync(file) && statSync(file).isFile();
    },
    expand: () => themeIds,
    functionPaths: ['/mcp'],
  });
  expect(problems).toEqual([]);
  // The home page advertises it as service-desc.
  const home = await viaEdge('/');
  expect(home.headers.get('link')).toContain('</openapi.json>; rel="service-desc"');
});

test('/api/v1/ answers through the middleware with X-API-Version and the rate-limit fields', async () => {
  for (const resource of API_RESOURCES.filter((entry) => !entry.parameter)) {
    const response = await viaEdge(resource.alias);
    expect(response.status, resource.alias).toBe(200);
    expect(response.headers.get('x-api-version'), resource.alias).toBe(API_VERSION);
    expect(response.headers.get('ratelimit-policy')).toBe('"api";q=300;w=60');
    expect(response.headers.get('ratelimit')).toMatch(/^"api";r=\d+;t=\d+$/);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    const body = await response.text();
    // The alias is the site file, byte for byte, read through the mapping.
    expect(body, resource.alias).toBe(readFileSync(join(DIST, resource.path.slice(1)), 'utf8'));
    JSON.parse(body);
  }
  const theme = await viaEdge('/api/v1/themes/ocean.json');
  expect(theme.status).toBe(200);
  expect(((await theme.json()) as { id: string }).id).toBe('ocean');

  const index = await viaEdge('/api/v1/');
  expect(((await index.json()) as { version: string }).version).toBe(API_VERSION);

  const miss = await viaEdge('/api/v1/no-such-file.json', {
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/131', accept: 'text/html' },
  });
  expect(miss.status).toBe(404);
  expect(miss.headers.get('content-type')).toBe('application/problem+json');
  expect(miss.headers.get('x-api-version')).toBe(API_VERSION);
  expect(((await miss.json()) as { error: { code: string } }).error.code).toBe(
    'resource_not_found'
  );

  const write = await viaEdge('/api/v1/catalog.json', { method: 'POST' });
  expect(write.status).toBe(405);
});

test('the aliases exist only through the middleware; the static API files keep the _headers rule', () => {
  // The build writes no alias file: the middleware reads each alias's source.
  expect(existsSync(join(DIST, 'api', 'v1'))).toBe(false);
  expect(asset(new Request(`${SITE}/api/v1/catalog.json`)).status).toBe(404);
  for (const path of ['/api/index.json', '/api/health.json']) {
    const response = asset(new Request(`${SITE}${path}`));
    expect(response.status, path).toBe(200);
    expect(response.headers.get('x-api-version'), path).toBe(API_VERSION);
    expect(response.headers.get('access-control-allow-origin'), path).toBe('*');
    // A static rule cannot count requests: no rate-limit fields here.
    expect(response.headers.get('ratelimit'), path).toBeNull();
  }
});

test('the built ARD catalog lists the npm packages', async () => {
  const response = await viaEdge('/.well-known/ai-catalog.json');
  const ard = (await response.json()) as { entries: { type: string; url: string }[] };
  const npm = ard.entries
    .filter((entry) => entry.type === 'application/vnd.npm.package+json')
    .map((entry) => entry.url);
  expect(npm).toEqual(
    expect.arrayContaining([
      'https://www.npmjs.com/package/@texuli/mcp',
      'https://www.npmjs.com/package/@texuli/tools',
    ])
  );
});
