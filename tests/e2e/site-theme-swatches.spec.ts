/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * Theme swatches paint each theme's own primary/accent/surface (not the active site theme).
 * Static dist. TEXULI_E2E_PORT for the lane.
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
  if (!existsSync(join(DIST, 'theme-switcher', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /theme-switcher/).');
  }
  if (!existsSync(join(DIST, 'gallery-themes', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /gallery-themes/).');
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
  await page.waitForLoadState('networkidle');
  return foreign;
}

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

/** Read computed background of the primary swatch chip for a theme card. */
async function primarySwatchRgb(page: Page, themeId: string): Promise<string> {
  return page.evaluate((id) => {
    const card = document.querySelector(`[data-theme-id="${id}"]`);
    const chip =
      card?.querySelector('.swatch-primary, [data-tx-swatch-primary]') ??
      card?.querySelector('.swatch-row .dot:nth-child(3)');
    // Prefer the primary chip; fall back to data attribute on the row.
    const target =
      card?.querySelector('.swatch-primary') ??
      card?.querySelector('.swatch-row [title="primary"]') ??
      chip;
    if (!target) return '';
    return getComputedStyle(target as Element).backgroundColor;
  }, themeId);
}

test.describe('texuli.com theme swatches paint each theme', () => {
  test('switcher: two themes expose different primary swatch colors', async ({ page }) => {
    expect(await visit(page, '/theme-switcher/')).toEqual([]);
    await expect(page.locator('[data-tx-theme-switcher]')).toBeVisible();

    const cards = page.locator('[data-tx-theme-switcher] [data-theme-id]');
    await expect(cards.first()).toBeVisible();
    const idA = await cards.nth(0).getAttribute('data-theme-id');
    const idB = await cards.nth(1).getAttribute('data-theme-id');
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);

    const attrA = await cards
      .nth(0)
      .locator('[data-tx-swatch-primary]')
      .getAttribute('data-tx-swatch-primary');
    const attrB = await cards
      .nth(1)
      .locator('[data-tx-swatch-primary]')
      .getAttribute('data-tx-swatch-primary');
    expect(attrA).toMatch(/^#/);
    expect(attrB).toMatch(/^#/);
    expect(attrA!.toLowerCase()).not.toBe(attrB!.toLowerCase());

    const rgbA = await primarySwatchRgb(page, idA!);
    const rgbB = await primarySwatchRgb(page, idB!);
    expect(rgbA).toBeTruthy();
    expect(rgbB).toBeTruthy();
    expect(rgbA).not.toBe(rgbB);
  });

  test('gallery: two visible cards have different primary swatch colors', async ({ page }) => {
    expect(await visit(page, '/gallery-themes/')).toEqual([]);
    await expect(page.locator('[data-tx-theme-gallery]')).toBeVisible();
    const cards = page.locator('[data-tx-theme-gallery] [data-theme-id]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const idA = await cards.nth(0).getAttribute('data-theme-id');
    const idB = await cards.nth(1).getAttribute('data-theme-id');
    const primaryA = await cards
      .nth(0)
      .locator('[data-tx-swatch-primary]')
      .getAttribute('data-tx-swatch-primary');
    const primaryB = await cards
      .nth(1)
      .locator('[data-tx-swatch-primary]')
      .getAttribute('data-tx-swatch-primary');
    expect(primaryA).toMatch(/^#/);
    expect(primaryB).toMatch(/^#/);
    expect(primaryA!.toLowerCase()).not.toBe(primaryB!.toLowerCase());
    expect(idA).not.toBe(idB);
  });

  test('stays on origin for switcher and gallery', async ({ page }) => {
    expect(await visit(page, '/theme-switcher/')).toEqual([]);
    expect(await visit(page, '/gallery-themes/')).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the theme switcher (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, '/theme-switcher/');
      expect(await mode(page)).toBe(scheme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${scheme} ${v.id}`)).toEqual([]);
    });
  }
});
