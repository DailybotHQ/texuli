/// <reference types="node" />
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/*
 * Analytics enabled-path verification (T-39): against a fixture build
 * (built with PUBLIC_UMAMI_WEBSITE_ID set), the loader mounts, the script
 * loads through the same-origin proxy and never from a foreign origin,
 * and auditing tools get no injection at all. Skips against a no-env
 * build, so the normal suite run stays meaningful:
 *
 *   PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id pnpm build
 *   TEXULI_E2E_PORT=4942 pnpm exec playwright test tests/e2e/analytics-fixture.spec.ts --project=chromium
 *
 * (The static host has no functions, so /api/umami/* 404s here — the
 * request event is the evidence, and the live proxy behavior is the
 * route handler's unit suite plus the owner's wrangler smoke.)
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const LIGHTHOUSE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse';

const indexHtml = existsSync(join(DIST, 'index.html'))
  ? readFileSync(join(DIST, 'index.html'), 'utf8')
  : '';
const fixtureBuild = indexHtml.includes('data-umami-loader');

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

test.skip(!fixtureBuild, 'fixture build only: PUBLIC_UMAMI_WEBSITE_ID=... pnpm build');

test.describe('the enabled path stays first-party and skips audits', () => {
  test('the mount tag carries the proxy src and the loader attributes', () => {
    expect(indexHtml).toContain('src="/umami-loader.js"');
    expect(indexHtml).toContain('data-umami-loader');
    expect(indexHtml).toContain('data-script-src="/api/umami/script.js"');
    expect(indexHtml).toContain('data-website-id=');
    expect(indexHtml).toContain('data-host-url="/api/umami"');
    expect(indexHtml).not.toContain('cloud.umami.is');
  });

  test('a real browser injects the script from the same origin only', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const analyticsRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/api\/umami\/|umami-loader\.js|cloud\.umami\.is/.test(request.url())) {
        analyticsRequests.push(request.url());
      }
    });
    await page.goto(`${origin}/`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(250);
    // The loader file mounted; the script came through the proxy; nothing foreign.
    expect(analyticsRequests.some((url) => url.includes('/umami-loader.js'))).toBe(true);
    expect(analyticsRequests.filter((url) => url.includes('/api/umami/script.js')).length).toBe(1);
    expect(analyticsRequests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
    await context.close();
  });

  test('an auditing client gets no injection', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: LIGHTHOUSE_UA });
    const page = await context.newPage();
    const scriptRequests: string[] = [];
    let loaderRequested = false;
    page.on('request', (request) => {
      if (request.url().includes('/umami-loader.js')) loaderRequested = true;
      if (request.url().includes('/api/umami/script.js')) scriptRequests.push(request.url());
    });
    await page.goto(`${origin}/`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(250);
    // The loader file is mounted (the tag is in the HTML) but it must
    // inject nothing for the Lighthouse family.
    expect(loaderRequested).toBe(true);
    expect(scriptRequests).toEqual([]);
    await context.close();
  });
});
