/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { siteSearch } from './support/site-nav.ts';

/*
 * Site search: static index + ⌘K command palette on /search/ and in the sidebar
 * (the phone drawer below 64rem).
 * Served from apps/website/dist like a static host (no runtime network).
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

const PATHS = ['/search/', '/search/?q=button', '/'] as const;

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

test.describe('texuli.com search', () => {
  test('search page lists browse groups and query results without foreign requests', async ({
    page,
  }) => {
    expect(await visit(page, '/search/')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browse' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Themes' })).toBeVisible();
    await expect(await siteSearch(page)).toBeVisible();

    expect(await visit(page, '/search/?q=button')).toEqual([]);
    await expect(page.locator('[data-tx-search-query]')).toHaveText('button');
    await expect(
      page.locator('[data-tx-search-page] a').filter({ hasText: 'Button' }).first()
    ).toBeVisible();
  });

  test('⌘/Ctrl+K opens the command palette and search finds docs', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Keyboard shortcut check on desktop.');
    await visit(page, '/search/');
    await (await siteSearch(page)).locator('button').click();
    const dialog = page.getByRole('dialog', { name: 'Search Texuli' });
    await expect(dialog).toBeVisible();
    const input = dialog.locator('input').first();
    await input.fill('overview');
    await expect(dialog.getByText(/Overview/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('the shortcut loads the palette on first use, then toggles it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Keyboard shortcut check on desktop.');
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await visit(page, '/');
    await siteSearch(page);
    // Only the trigger ships with the page: the palette and its index wait for a search.
    expect(scripts.some((url) => /SitePalette/.test(url))).toBe(false);

    const dialog = page.getByRole('dialog', { name: 'Search Texuli' });
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible();
    expect(scripts.some((url) => /SitePalette/.test(url))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeHidden();
  });

  for (const dir of ['ltr', 'rtl'] as const) {
    test(`the command palette opens centered (${dir})`, async ({ page }) => {
      await visit(page, '/component-pages/');
      if (dir === 'rtl')
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      await (await siteSearch(page)).locator('button').click();
      const panel = page.locator('.tx-command-palette__content').first();
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      const width = page.viewportSize()?.width ?? 0;
      expect(box).not.toBeNull();
      // The popover UA style (inset: 0; margin: auto) once pushed it 32px off center.
      expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThanOrEqual(1);
    });
  }

  test('the header exposes a search trigger on the home page', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    const search = await siteSearch(page);
    await expect(search).toBeVisible();
    await search.locator('button').click();
    await expect(page.getByRole('dialog', { name: 'Search Texuli' })).toBeVisible();
  });

  test('stays on origin across search paths', async ({ page }) => {
    for (const path of PATHS) {
      expect(await visit(page, path)).toEqual([]);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on search pages (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/search/', '/search/?q=button']) {
        await visit(page, path);
        expect(await mode(page)).toBe(scheme);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((v) => `${path} ${v.id}`)).toEqual([]);
      }
    });
  }
});
