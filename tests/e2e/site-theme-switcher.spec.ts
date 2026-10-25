/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * texuli.com theme switcher: built static page with the full library CSS
 * inlined, mode + theme persistence via the no-flash appearance cache, no
 * foreign network, axe in light and dark on desktop and Pixel 7.
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
    throw new Error('Run `pnpm build` before this spec (missing theme-switcher page).');
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

async function visit(page: Page, path = '/theme-switcher/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
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

async function clickMode(page: Page, name: string) {
  const group = page.getByRole('group', { name: 'Mode' });
  await group.getByRole('radio', { name }).or(group.getByRole('button', { name })).click();
}

test.describe('texuli.com theme switcher', () => {
  test('lists the library and switches theme + mode without leaving the origin', async ({
    page,
  }) => {
    const foreign = await visit(page);
    expect(foreign).toEqual([]);
    await expect(page).toHaveTitle(/Theme switcher/);
    await expect(page.getByRole('heading', { level: 1, name: 'Theme and mode' })).toBeVisible();

    const options = page.getByRole('option');
    await expect.poll(async () => options.count()).toBeGreaterThanOrEqual(200);

    await clickMode(page, 'Dark');
    expect(await modeAttr(page)).toBe('dark');
    expect(await bodyLuminance(page)).toBeLessThan(0.35);

    await clickMode(page, 'Light');
    expect(await modeAttr(page)).toBe('light');
    expect(await bodyLuminance(page)).toBeGreaterThan(0.6);

    await clickMode(page, 'High contrast');
    expect(await modeAttr(page)).toBe('high-contrast');

    // Pick a non-default theme if present.
    const violet = page.locator('[data-theme-id="violet"]');
    if ((await violet.count()) > 0) {
      await violet.click();
      expect(await themeAttr(page)).toBe('violet');
    } else {
      const second = options.nth(1);
      const id = await second.getAttribute('data-theme-id');
      await second.click();
      expect(await themeAttr(page)).toBe(id);
    }

    await page.getByLabel('Find a theme').fill('enterprise');
    await expect.poll(async () => options.count()).toBeGreaterThan(0);
    await expect(page.locator('[data-theme-id="enterprise-neutral"]')).toBeVisible();
  });

  test('persists theme and mode across reload with no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await visit(page);
    await clickMode(page, 'Dark');
    const target = page.locator('[data-theme-id="ocean"]');
    if ((await target.count()) > 0) await target.click();
    else await page.getByRole('option').nth(2).click();
    const chosenTheme = await themeAttr(page);
    expect(await modeAttr(page)).toBe('dark');

    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') {
          const root = document.documentElement;
          (
            window as unknown as { earlyTheme?: string | null; earlyMode?: string | null }
          ).earlyTheme = root.getAttribute('data-tx-theme');
          (window as unknown as { earlyMode?: string | null }).earlyMode =
            root.getAttribute('data-tx-mode');
        }
      });
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    const early = await page.evaluate(() => ({
      theme: (window as unknown as { earlyTheme?: string }).earlyTheme,
      mode: (window as unknown as { earlyMode?: string }).earlyMode,
    }));
    expect(early.mode).toBe('dark');
    expect(early.theme).toBe(chosenTheme);
    expect(await modeAttr(page)).toBe('dark');
    expect(await themeAttr(page)).toBe(chosenTheme);
    expect(await bodyLuminance(page)).toBeLessThan(0.35);
  });

  test('is static: no foreign requests on the switcher page', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    expect(
      await page.evaluate(() => performance.getEntriesByType('resource').length)
    ).toBeGreaterThan(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the switcher (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      // Force explicit mode so axe sees the intended palette even if cache differs.
      await clickMode(page, scheme === 'dark' ? 'Dark' : 'Light');
      expect(await modeAttr(page)).toBe(scheme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }
});
