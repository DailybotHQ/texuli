/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com color explorer: OKLCH scales, roles, contrast pairs, export.
 * Built static site — run `pnpm build` first.
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
  if (!existsSync(join(DIST, 'color-explorer', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing color-explorer page).');
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

async function visit(page: Page, path = '/color-explorer/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test.describe('texuli.com color explorer', () => {
  test('shows scales, roles, pairs and export controls', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    await expect(page).toHaveTitle('Color explorer · Texuli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Color and token explorer' })
    ).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Colors', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await expect(page.getByRole('heading', { name: 'OKLCH scales' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Semantic roles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contrast pairs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();

    await expect(page.getByRole('group', { name: 'Color mode' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Export format' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy css/i })).toBeVisible();
    await expect(page.locator('[data-tx-color-explorer] pre code')).toContainText('--tx-');
  });

  async function clickGroupItem(page: Page, groupName: string, itemName: string) {
    const group = page.getByRole('group', { name: groupName });
    const item = group
      .getByRole('radio', { name: itemName })
      .or(group.getByRole('button', { name: itemName }));
    await item.scrollIntoViewIfNeeded();
    await item.evaluate((node) => {
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await item.click();
  }

  test('switches mode and export format without foreign network', async ({ page }) => {
    test.setTimeout(60_000);
    expect(await visit(page)).toEqual([]);
    await clickGroupItem(page, 'Color mode', 'Dark');
    await expect.poll(async () => mode(page), { timeout: 15_000 }).toBe('dark');

    await clickGroupItem(page, 'Export format', 'JSON');
    await expect(page.locator('[data-tx-color-explorer] pre code')).toContainText('"id"', {
      timeout: 10_000,
    });
    await clickGroupItem(page, 'Export format', 'Tailwind');
    await expect(page.locator('[data-tx-color-explorer] pre code')).toContainText('--color-', {
      timeout: 10_000,
    });
  });

  test('is static: no foreign network', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      // Page may set mode via preference; ensure axe still clean.
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
