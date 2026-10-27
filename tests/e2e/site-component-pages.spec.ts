/// <reference types="node" />
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com component pages: static HTML from catalog manifests.
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
let sampleIds: string[] = [];

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec.');
  }
  const dir = join(DIST, 'component-pages');
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error('component-pages missing from dist — rebuild the website.');
  }
  sampleIds = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .slice(0, 12);
  if (sampleIds.length < 3) {
    throw new Error('Expected multiple generated component page folders in dist.');
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

test.describe('texuli.com component pages', () => {
  test('index lists components and nav marks the components overview', async ({ page }) => {
    expect(await visit(page, '/component-pages/')).toEqual([]);
    await expect(page).toHaveTitle(/Components/);
    await expect(page.getByRole('heading', { level: 1, name: 'Components' })).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.locator('[href^="/component-pages/"]').first()).toBeVisible();
  });

  test('sample component pages expose required sections', async ({ page }) => {
    for (const id of sampleIds.slice(0, 5)) {
      const path = `/component-pages/${id}/`;
      expect(await visit(page, path), path).toEqual([]);
      await expect(page.locator(`[data-tx-component-page="${id}"]`)).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Examples' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Props' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Keyboard' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Accessibility' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'When to use' })).toBeVisible();
      await expect(page.getByRole('table').first()).toBeVisible();
    }
  });

  test('component routes stay on-origin', async ({ page }) => {
    expect(await visit(page, '/component-pages/')).toEqual([]);
    for (const id of sampleIds.slice(0, 8)) {
      expect(await visit(page, `/component-pages/${id}/`), id).toEqual([]);
    }
  });

  // axe on every component page in light and dark (zero exclusions) runs in the page
  // sweep, a11y-site.spec.ts.
});
