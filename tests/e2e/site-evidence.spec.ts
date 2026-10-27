/// <reference types="node" />
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com evidence: strip on every component page + /evidence/ index.
 * Run `pnpm build` first.
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
let sampleIds: string[] = [];

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'evidence', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /evidence/).');
  }
  const dir = join(DIST, 'component-pages');
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error('component-pages missing from dist — rebuild.');
  }
  sampleIds = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  // Prefer known ids with behavior checks + size
  const preferred = ['button', 'dialog', 'badge', 'card', 'combobox'].filter((id) =>
    sampleIds.includes(id)
  );
  sampleIds = [...preferred, ...sampleIds.filter((id) => !preferred.includes(id))].slice(0, 8);

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

test.describe('texuli.com evidence', () => {
  test('evidence index explains methodology and samples', async ({ page }) => {
    expect(await visit(page, '/evidence/')).toEqual([]);
    await expect(page).toHaveTitle('Evidence · Texuli');
    await expect(page.getByRole('heading', { level: 1, name: 'Evidence' })).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Evidence', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.getByText(/behavior checks/i).first()).toBeVisible();
    await expect(page.locator('[data-tx-evidence]').first()).toBeVisible();
  });

  test('every sampled component page shows an evidence strip', async ({ page }) => {
    for (const id of sampleIds) {
      expect(await visit(page, `/component-pages/${id}/`), id).toEqual([]);
      const strip = page.locator(`[data-tx-evidence="${id}"]`);
      await expect(strip, id).toBeVisible();
      await expect(strip.getByRole('heading', { name: 'Evidence' })).toBeVisible();
      await expect(strip.getByRole('heading', { name: 'Behavior' })).toBeVisible();
      await expect(strip.getByRole('heading', { name: 'Size (gzip)' })).toBeVisible();
      await expect(strip.getByRole('heading', { name: 'Axe' })).toBeVisible();
      await expect(strip.getByRole('heading', { name: 'Browsers' })).toBeVisible();
      await expect(strip.getByText(/chromium/)).toBeVisible();
    }
  });

  test('is static: no foreign network on evidence and samples', async ({ page }) => {
    expect(await visit(page, '/evidence/')).toEqual([]);
    for (const id of sampleIds.slice(0, 3)) {
      expect(await visit(page, `/component-pages/${id}/`), id).toEqual([]);
    }
  });

  // axe on /evidence/ and every component page in light and dark (zero exclusions)
  // runs in the page sweep, a11y-site.spec.ts.
});
