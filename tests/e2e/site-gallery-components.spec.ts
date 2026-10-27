/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com component gallery: visual index, category/tag filters,
 * no foreign network, axe in light and dark on desktop and Pixel 7.
 * Run `pnpm build` first. Serves apps/website/dist on an ephemeral port.
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

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'gallery-components', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing gallery-components page).');
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

async function visit(page: Page, path = '/gallery-components/') {
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

test.describe('texuli.com component gallery', () => {
  test('lists components and primary nav marks Gallery', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    await expect(page).toHaveTitle(/Component gallery/);
    await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Gallery', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const cards = page.locator('[data-tx-gallery-card]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(15);
  });

  test('filters by category and search', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    const catGroup = page.getByRole('group', { name: 'Category' });
    await catGroup
      .getByRole('radio', { name: 'display' })
      .or(catGroup.getByRole('button', { name: 'display' }))
      .click();
    await expect(page.locator('[data-tx-gallery-card]').first()).toBeVisible();
    const categories = await page
      .locator('[data-tx-gallery-card]')
      .evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute('data-category')))]);
    expect(categories).toEqual(['display']);

    await page.getByLabel('Search').fill('badge');
    await expect(page.locator('[data-tx-gallery-card="badge"]')).toBeVisible();
  });

  test('gallery stays on-origin', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
  });

  // axe on this page in light and dark (zero exclusions) runs in the page sweep,
  // a11y-site.spec.ts.
});
