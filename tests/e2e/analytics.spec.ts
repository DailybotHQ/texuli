/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/*
 * Analytics default-off verification (T-39): the committed build carries
 * no PUBLIC_UMAMI_WEBSITE_ID, so every page is provably silent — zero
 * analytics markup, zero analytics requests. The enabled path (same-origin
 * proxy only, audit bots skipped) is proven against a fixture build by
 * tests/e2e/analytics-fixture.spec.ts with its own config; the loader's
 * skip list and injection are unit-proven in apps/website/tests/.
 * Built static site only; run `pnpm build` first.
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** Anything that would smell like analytics leaving the site. */
const ANALYTICS_REQUEST = /\/api\/umami\/|umami-loader\.js|cloud\.umami\.is/;

const ROUTES = ['/', '/guides/', '/guides/theming/', '/component-pages/button/', '/native/'];

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => {
  server.close();
});

test.describe('analytics is silent without env config', () => {
  for (const route of ROUTES) {
    test(`no analytics markup or requests on ${route}`, async ({ page }) => {
      const analyticsRequests: string[] = [];
      page.on('request', (request) => {
        if (ANALYTICS_REQUEST.test(request.url())) analyticsRequests.push(request.url());
      });
      await page.goto(`${origin}${route}`);
      await page.waitForLoadState('load');
      const html = await page.content();
      expect(html, 'no analytics script tag in the served page').not.toContain('umami-loader');
      expect(html).not.toContain('data-umami-loader');
      expect(html).not.toContain('cloud.umami.is');
      expect(analyticsRequests, 'zero analytics requests').toEqual([]);
    });
  }
});
