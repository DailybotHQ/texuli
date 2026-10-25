/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * texuli.com theme gallery: live preview cards, AA scores, one-click apply,
 * no foreign network, axe in light and dark on desktop and Pixel 7.
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
  if (!existsSync(join(DIST, 'gallery-themes', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing gallery-themes page).');
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

async function visit(page: Page, path = '/gallery-themes/') {
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

const themeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-theme');
const modeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

const bodyLuminance = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return -1;
    probe.fillStyle = getComputedStyle(document.body).backgroundColor;
    probe.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  });

async function clickGroup(page: Page, groupName: string, itemName: string) {
  const group = page.getByRole('group', { name: groupName });
  await group
    .getByRole('radio', { name: itemName })
    .or(group.getByRole('button', { name: itemName }))
    .click();
}

test.describe('texuli.com theme gallery', () => {
  test('lists live preview cards with scores and filters', async ({ page }) => {
    const foreign = await visit(page);
    expect(foreign).toEqual([]);
    await expect(page).toHaveTitle(/Theme gallery/);
    await expect(page.getByRole('heading', { level: 1, name: 'Theme gallery' })).toBeVisible();

    // Cards render 24 at a time (T-site-perf); the summary still counts the whole library.
    const cards = page.locator('[data-theme-id]');
    await expect(cards).toHaveCount(24);
    await expect(page.getByRole('status').first()).toContainText(/2\d\d themes/);
    await page.getByRole('button', { name: 'Show 24 more', exact: true }).click();
    await expect(cards).toHaveCount(48);

    // Live preview surface + score rows.
    const first = cards.first();
    await expect(first.locator('[data-preview-surface]')).toBeVisible();
    await expect(first.locator('.scores .score-row')).toHaveCount(3);
    await expect(first.getByRole('button', { name: /Apply light/i }).first()).toBeVisible();

    await clickGroup(page, 'Card preview mode', 'Dark');
    await expect(first.locator('[data-preview-surface]')).toHaveAttribute('data-tx-mode', 'dark');

    await page.getByLabel('Find a theme').fill('enterprise');
    await expect.poll(async () => cards.count()).toBeGreaterThan(0);
    await expect(page.locator('[data-theme-id="enterprise-neutral"]')).toBeVisible();
  });

  test('one-click apply persists theme and mode with no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await visit(page);

    const violet = page.locator('[data-theme-id="violet"]');
    const target = (await violet.count()) > 0 ? violet : page.locator('[data-theme-id]').nth(1);
    const id = await target.getAttribute('data-theme-id');
    await target.locator('[data-apply-mode="dark"]').click();

    expect(await themeAttr(page)).toBe(id);
    expect(await modeAttr(page)).toBe('dark');
    expect(await bodyLuminance(page)).toBeLessThan(0.35);

    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') {
          const root = document.documentElement;
          (window as unknown as { earlyTheme?: string | null }).earlyTheme =
            root.getAttribute('data-tx-theme');
          (window as unknown as { earlyMode?: string | null }).earlyMode =
            root.getAttribute('data-tx-mode');
        }
      });
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.txPageReady === 'true' ||
        (!document.querySelector('script[data-tx-ready-script]') &&
          document.readyState === 'complete'),
      undefined,
      { polling: 250 }
    );
    const early = await page.evaluate(() => ({
      theme: (window as unknown as { earlyTheme?: string }).earlyTheme,
      mode: (window as unknown as { earlyMode?: string }).earlyMode,
    }));
    expect(early.theme).toBe(id);
    expect(early.mode).toBe('dark');
    expect(await themeAttr(page)).toBe(id);
    expect(await modeAttr(page)).toBe('dark');
  });

  test('is static: no foreign requests', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the gallery (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      await clickGroup(page, 'Card preview mode', scheme === 'dark' ? 'Dark' : 'Light');
      // Keep the page mode aligned for axe by applying the site default theme in that mode.
      const enterprise = page.locator('[data-theme-id="enterprise-neutral"]');
      if ((await enterprise.count()) > 0) {
        await enterprise.locator(`[data-apply-mode="${scheme}"]`).click();
      }
      expect(await modeAttr(page)).toBe(scheme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }
});
