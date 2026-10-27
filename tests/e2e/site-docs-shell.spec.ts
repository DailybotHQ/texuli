/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/*
 * Docs shell (apps/website/src/pages/docs-shell): static layout with sidebar,
 * TOC, previous/next, mobile details menu. Served from dist like a static host.
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const DOCS_PATHS = [
  '/docs-shell/',
  '/docs-shell/getting-started/',
  '/docs-shell/navigation/',
] as const;

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec.');
  }
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '404');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

async function visit(page: Page, path: string) {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  return foreign;
}

test.describe('texuli.com docs shell', () => {
  test('sidebar marks the current page and pager moves in reading order', async ({ page }) => {
    expect(await visit(page, '/docs-shell/')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Docs shell' })).toBeVisible();
    await expect(page.locator('[data-tx-docs-shell]')).toBeVisible();

    // Current page is marked on every nav copy (desktop sidebar + mobile details).
    const current = page.locator('[data-tx-docs-shell] a[aria-current="page"]').first();
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(current).toHaveText('Overview');

    const pager = page.getByRole('navigation', { name: 'Page' });
    await pager.getByRole('link', { name: /Getting started/i }).click();
    await expect(page).toHaveURL(`${origin}/docs-shell/getting-started/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();

    await pager.getByRole('link', { name: /Navigation/i }).click();
    await expect(page).toHaveURL(`${origin}/docs-shell/navigation/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Navigation' })).toBeVisible();
  });

  test('table of contents targets in-page headings', async ({ page }) => {
    await visit(page, '/docs-shell/');
    // Mobile + desktop TOC copies both point at the same anchors.
    await expect(page.locator('[data-tx-docs-toc] a[href="#static-and-local"]')).toHaveCount(2);
    await expect(page.locator('#static-and-local')).toHaveAttribute('id', 'static-and-local');
    await expect(page.getByRole('heading', { level: 2, name: 'Static and local' })).toBeVisible();
    // Direct hash navigation stays on origin.
    expect(await visit(page, '/docs-shell/#static-and-local')).toEqual([]);
    await expect(page.locator('#static-and-local')).toBeVisible();
  });

  // PLAN_006 P2-3: the side-column TOC shows from 64rem (it never did: the
  // base display:none rule came after the media query) and stays the only one.
  test(`exactly one visible "On this page" navigation at 1100 and 1400px`, async ({ page }) => {
    for (const width of [1100, 1400]) {
      await page.setViewportSize({ width, height: 900 });
      await visit(page, '/docs-shell/');
      const tocs = page.getByRole('navigation', { name: 'On this page' });
      await expect(tocs).toHaveCount(1);
      await expect(tocs.first().locator('a[href="#static-and-local"]')).toBeVisible();
    }
  });

  test('mobile menu lists the same destinations without foreign requests', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Narrow viewport menu.');
    const foreign = await visit(page, '/docs-shell/getting-started/');
    expect(foreign).toEqual([]);
    const menu = page.locator('[data-tx-docs-mobile-nav]');
    await expect(menu).toBeVisible();
    await menu.locator('summary').click();
    await menu.getByRole('link', { name: 'Navigation' }).click();
    await expect(page).toHaveURL(`${origin}/docs-shell/navigation/`);
  });

  test('is edit-free and stays on origin', async ({ page }) => {
    for (const path of DOCS_PATHS) {
      expect(await visit(page, path)).toEqual([]);
      await expect(page.getByRole('link', { name: /edit on github/i })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /edit this page/i })).toHaveCount(0);
    }
  });

  // axe on the docs pages in light and dark (zero exclusions) runs in the page sweep,
  // a11y-site.spec.ts.
});
