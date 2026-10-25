/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { listExampleIds } from '../../packages/examples/src/index.ts';

/*
 * texuli.com examples: registry listing + isolated same-origin preview iframes.
 * Built static site only. No foreign HTTP(S).
 */

const DIST = resolve('apps/website/dist');
const EXPECTED_COUNT = listExampleIds().length;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'examples', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing examples/).');
  }
  if (!existsSync(join(DIST, 'examples', 'texuli-button', 'index.html'))) {
    throw new Error('Missing examples/texuli-button detail page.');
  }
  if (!existsSync(join(DIST, 'examples', 'preview', 'texuli-button', 'index.html'))) {
    throw new Error('Missing examples/preview/texuli-button isolated preview.');
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

async function visit(page: Page, path = '/examples/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (!url.startsWith(origin)) foreign.push(url);
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

test.describe('texuli.com examples', () => {
  test('lists every registered example and filters by package', async ({ page }) => {
    const foreign = await visit(page);
    expect(foreign).toEqual([]);
    await expect(page).toHaveTitle(/Examples/);
    await expect(page.getByRole('heading', { level: 1, name: 'Examples' })).toBeVisible();

    const cards = page.locator('[data-example-id]');
    await expect.poll(async () => cards.count()).toBe(EXPECTED_COUNT);
    expect(EXPECTED_COUNT).toBeGreaterThan(50);

    await page.getByLabel('Find an example').fill('texuli-button');
    await expect(page.locator('[data-example-id="texuli-button"]')).toBeVisible();
    await expect(page.locator('[data-example-id="texuli-button"]')).toHaveAttribute(
      'data-package',
      'texuli'
    );
  });

  test('click-to-load iframe preview with frame toggles; full-page stays link-only on listing', async ({
    page,
  }) => {
    await visit(page);
    await page.getByLabel('Find an example').fill('texuli-button');
    const card = page.locator('[data-example-id="texuli-button"]');
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('button', { name: 'Load live example' }).click();
    const iframeSlot = card.locator('[data-tx-example-iframe="texuli-button"]');
    await expect.poll(async () => iframeSlot.getAttribute('data-active')).toBe('true');
    const frame = card.locator('[data-tx-example-frame]').first();
    const dark = frame.getByRole('group', { name: /color mode/i }).getByRole('button', {
      name: 'Dark',
      exact: true,
    });
    await dark.scrollIntoViewIfNeeded();
    await dark.click();
    await expect(frame).toHaveAttribute('data-tx-mode', 'dark');
    await expect(iframeSlot.locator('iframe')).toHaveAttribute('src', /mode=dark/);
    await expect(iframeSlot.locator('iframe')).toHaveAttribute('src', /embed=1/);

    await page.getByLabel('Find an example').fill('texuli-app-layouts');
    const full = page.locator('[data-example-id="texuli-app-layouts"]');
    await expect(full).toHaveAttribute('data-full-page', 'true');
    await expect(full.getByRole('link', { name: 'Open the live example' }).first()).toBeVisible();
    await expect(full.locator('iframe')).toHaveCount(0);
  });

  test('detail route click-loads isolated iframe; preview page is interactive', async ({
    page,
  }) => {
    const foreign = await visit(page, '/examples/texuli-button/');
    expect(foreign).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: /Button/i })).toBeVisible();
    await page.getByRole('button', { name: 'Load live example' }).click();
    const iframe = page.locator('[data-tx-example-iframe="texuli-button"] iframe');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('title', /Live example/);
    await expect(iframe).toHaveAttribute('src', /embed=1/);

    // Interact inside the standalone preview document (embed off).
    await visit(page, '/examples/preview/texuli-button/?embed=0');
    const host = page.locator('[data-tx-example-preview-host="texuli-button"]');
    await expect.poll(async () => host.getAttribute('data-loaded')).toBe('true');
    await expect(host).toHaveAttribute('data-embed', 'false');
    const demoButton = host.getByRole('button', { name: 'Default' }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();
  });

  test('is static: no foreign http(s) requests', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on examples index (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      await page.getByLabel('Find an example').fill('core-safe-href');
      await expect(page.locator('[data-example-id]')).toHaveCount(1);
      await page.evaluate((mode) => {
        const root = document.documentElement;
        root.dataset.txMode = mode;
        root.classList.toggle('dark', mode === 'dark');
        root.classList.toggle('light', mode === 'light');
        root.style.colorScheme = mode;
      }, scheme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }

  test('passes axe on a detail page in forced-colors', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
    await visit(page, '/examples/texuli-button/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
