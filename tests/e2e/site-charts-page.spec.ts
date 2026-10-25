/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { CHART_FAMILIES } from '../../apps/website/src/components/charts-page/families.ts';
import { enterDocsFromLanding, primaryNav } from './support/site-nav.ts';

/*
 * Charts gallery on texuli.com: every family with contracts and live demos.
 * Served from apps/website/dist (static). Lane port via TEXULI_E2E_PORT.
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

const INDEX = '/charts-page/';
const FAMILY_PATHS = CHART_FAMILIES.map((f) => `/charts-page/${f.id}/`);

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'charts-page', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /charts-page/).');
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
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
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

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test.describe('texuli.com charts gallery', () => {
  test('index lists every family with contracts and demos without foreign network', async ({
    page,
  }) => {
    expect(await visit(page, INDEX)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Charts gallery' })).toBeVisible();
    const toc = page.getByRole('navigation', { name: 'Chart families' });
    await expect(toc).toBeVisible();

    for (const family of CHART_FAMILIES) {
      await expect(toc.getByRole('link', { name: family.title })).toBeVisible();
      const section = page.locator(`[data-tx-chart-family="${family.id}"]`);
      await expect(section).toBeVisible();
      await expect(section.getByRole('heading', { level: 2, name: family.title })).toBeVisible();
      await expect(section.getByRole('heading', { name: 'Data contract' })).toBeVisible();
      await expect(section.getByRole('table')).toBeVisible();
      await expect(section.locator(`[data-tx-charts-demo="${family.id}"]`)).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test('family pages render and stay on origin', async ({ page }) => {
    for (const path of FAMILY_PATHS) {
      expect(await visit(page, path)).toEqual([]);
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Data contract' })).toBeVisible();
    }
  });

  test('interaction demo exposes legend and selection status', async ({ page }) => {
    expect(await visit(page, '/charts-page/interaction/')).toEqual([]);
    const demo = page.locator('[data-tx-charts-demo="interaction"]');
    await expect(demo).toBeVisible();
    await expect(page.locator('[data-tx-charts-selection]')).toContainText('Selection:');
    await expect(page.locator('[data-tx-charts-domain]')).toContainText('Full range');
  });

  test('primary nav links to charts', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    await enterDocsFromLanding(page);
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Charts', exact: true })).toBeVisible();
    await primary.getByRole('link', { name: 'Charts', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/charts-page/`);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the charts index (${scheme})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, INDEX);
      expect(await mode(page)).toBe(scheme);
      // Wait for first demo island so hydrated chart chrome is in the tree.
      await expect(page.locator('[data-tx-charts-demo="cartesian"]')).toBeVisible({
        timeout: 15_000,
      });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${scheme} ${v.id}: ${v.help}`)).toEqual([]);
    });

    test(`passes axe on cartesian family page (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, '/charts-page/cartesian/');
      expect(await mode(page)).toBe(scheme);
      await expect(page.locator('[data-tx-charts-demo="cartesian"]')).toBeVisible({
        timeout: 15_000,
      });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `cartesian ${scheme} ${v.id}`)).toEqual([]);
    });
  }
});
