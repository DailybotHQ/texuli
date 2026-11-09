/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  activeSolutionRedirects,
  formatCloudflareRedirects,
  onRequest,
  SOLUTION_REDIRECT_KEEP,
  SOLUTION_REDIRECTS,
} from '../../functions/_middleware.ts';
import { DIST } from './support/site.ts';

/*
 * The five `*-page` routes moved to their Solution landings (ADR-028), on the built site
 * (`pnpm build` first).
 *
 * Which layer this covers. Playwright's `webServer` serves the fixture app, and the other
 * site specs serve `dist` from a plain static server, so neither runs Cloudflare Pages'
 * `_redirects` or its Functions. This spec therefore puts the real Pages middleware
 * (`functions/_middleware.ts`, `onRequest`) in front of `dist`, as site-twins.spec.ts does,
 * and drives it with fetch (status and Location, never following) and with the browser
 * (the redirect lands on the landing). That proves the middleware layer on the real build:
 * 301, Location, the query kept, both slash forms, the `.md` twins, Accept: text/markdown,
 * and the kept `/workflows-page/json/`. The `_redirects` layer is checked as a file: the
 * built `dist/_redirects` lists exactly the active map, both slash forms, 301, one hop.
 * Cloudflare's own runtime is verified only after a deploy.
 */

const SITE = 'https://texuli.com';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** The static host behind the middleware: a built file, or 404.html. */
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
  return new Response(readFileSync(file), {
    status: 200,
    headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
  });
}

let server: Server | undefined;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'solutions', 'slides', 'index.html')))
    throw new Error('Run `pnpm build` before this spec.');
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

/** One request that never follows a redirect. */
const hop = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${origin}${path}`, { headers, redirect: 'manual' });

const MOVES = SOLUTION_REDIRECTS.filter((rule) => rule.enabled);
const twinOf = (route: string) => `${route.replace(/\/$/, '')}.md`;

test('each moved page answers 301 to its landing, in both slash forms, keeping the query', async () => {
  expect(MOVES.map((rule) => rule.from)).toEqual([
    '/slides-page/',
    '/documents-page/',
    '/workflows-page/',
    '/canvas-page/',
    '/sheets-page/',
  ]);
  for (const { from, to } of MOVES) {
    const bare = from.slice(0, -1);
    for (const path of [from, bare]) {
      const response = await hop(path);
      expect(response.status, path).toBe(301);
      expect(response.headers.get('location'), path).toBe(to);
    }
    const query = await hop(`${from}?utm_source=example&tab=demo`);
    expect(query.status).toBe(301);
    expect(query.headers.get('location')).toBe(`${to}?utm_source=example&tab=demo`);
    const bareQuery = await hop(`${bare}?ref=example`);
    expect(bareQuery.headers.get('location')).toBe(`${to}?ref=example`);

    // One hop: the target itself answers 200, never another redirect.
    const target = await hop(to);
    expect(target.status, to).toBe(200);
  }
});

test('the Markdown twins move too: the .md path and Accept: text/markdown', async () => {
  for (const { from, to } of MOVES) {
    const md = await hop(twinOf(from));
    expect(md.status, twinOf(from)).toBe(301);
    expect(md.headers.get('location')).toBe(twinOf(to));

    const accept = await hop(from, { accept: 'text/markdown' });
    expect(accept.status, `${from} Accept`).toBe(301);
    expect(accept.headers.get('location')).toBe(twinOf(to));

    const twin = await hop(twinOf(to));
    expect(twin.status, twinOf(to)).toBe(200);
    expect(twin.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  }
});

test('/workflows-page/json/ is kept: it answers 200, never a redirect', async () => {
  expect([...SOLUTION_REDIRECT_KEEP]).toEqual(['/workflows-page/json/']);
  for (const path of ['/workflows-page/json/', '/workflows-page/json']) {
    const response = await hop(path);
    expect(response.status, path).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  }
  // Unrelated paths are untouched: no redirect for a near miss.
  expect((await hop('/slides-page-extra/')).headers.get('location')).toBeNull();
});

test('a browser following an old link lands on the landing with the query', async ({ page }) => {
  const response = await page.goto(`${origin}/slides-page/?from=old-link`);
  expect(page.url()).toBe(`${origin}/solutions/slides/?from=old-link`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('#solution-hero-slides')).toHaveText(
    'Decks written as data, presented on the web.'
  );
  const chain = response?.request().redirectedFrom();
  expect(chain?.url()).toBe(`${origin}/slides-page/?from=old-link`);
  expect(chain?.redirectedFrom()).toBeNull();
});

test('the built _redirects file lists exactly the active map: both slash forms, 301, one hop', () => {
  const file = readFileSync(join(DIST, '_redirects'), 'utf8');
  const lines = file
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const active = activeSolutionRedirects(SOLUTION_REDIRECTS, (to) =>
    existsSync(join(DIST, to, 'index.html'))
  );
  expect(active).toHaveLength(MOVES.length);
  expect(lines.join('\n')).toBe(formatCloudflareRedirects(active));
  const rules = lines.map((line) => line.split(/\s+/));
  const sources = new Set(rules.map(([from]) => from));
  for (const [from, to, status] of rules) {
    expect(status, from).toBe('301');
    expect(sources.has(to as string), `${from} chains to ${to}`).toBe(false);
    expect(existsSync(join(DIST, to as string, 'index.html')), to).toBe(true);
    expect(from).not.toMatch(/^\/workflows-page\/json/);
  }
});
