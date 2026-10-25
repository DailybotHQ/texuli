/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com foundation (apps/website): the built static site (`pnpm build`
 * first) served as plain files, the way a static host serves it. Routing,
 * the base layout, the theme in light and dark with no flash, no request to
 * any other origin, and axe on desktop and the Pixel 7.
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
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
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

/** Opens a site path, failing on any request to another origin. */
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
/** Relative luminance of the body background (0 black, 1 white). */
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

test.describe('texuli.com foundation', () => {
  test('pages share the base layout, and routing marks the current page', async ({ page }) => {
    // The home is a landing outside the docs shell; the docs start at /guides/.
    expect(await visit(page, '/guides/')).toEqual([]);
    await expect(page).toHaveTitle('Guides · Texuli');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    const home = await primaryNav(page);
    await expect(home.getByRole('link', { name: 'Introduction', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await home.getByRole('link', { name: 'Foundation', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/foundation/`);
    await expect(page).toHaveTitle('Foundation · Texuli');
    // On phones the drawer closed with the old page: open it again.
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Foundation', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(
      primary.getByRole('link', { name: 'Introduction', exact: true })
    ).not.toHaveAttribute('aria-current', /.*/);
    // Texuli's own components, rendered at build time.
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(4);
    await expect(page.locator('[data-tx-badge]')).toHaveCount(4);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://texuli.com/foundation/'
    );
  });

  test('the skip link moves focus to the main content', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'A keyboard check: desktop projects.');
    await visit(page, '/foundation/');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await skip.focus();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('is static: no request leaves the site, and an unknown path is a 404', async ({ page }) => {
    for (const path of ['/', '/foundation/']) expect(await visit(page, path)).toEqual([]);
    expect(
      await page.evaluate(() => performance.getEntriesByType('resource').length)
    ).toBeGreaterThan(0);
    const missing = await page.goto(`${origin}/no-such-page/`);
    expect(missing?.status()).toBe(404);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`follows the system ${scheme} scheme from the first paint`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, '/');
      expect(await mode(page)).toBe(scheme);
      const luminance = await bodyLuminance(page);
      if (scheme === 'dark') expect(luminance).toBeLessThan(0.1);
      else expect(luminance).toBeGreaterThan(0.8);
    });
  }

  test('the appearance switch persists a choice with no flash, and System clears it', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await visit(page, '/');
    const switcher = page.getByRole('group', { name: 'Appearance' });
    await switcher
      .getByRole('radio', { name: 'Dark' })
      .or(switcher.getByRole('button', { name: 'Dark' }))
      .click();
    expect(await mode(page)).toBe('dark');
    // The no-flash script applies the cached mode before any stylesheet or island.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive')
          (window as unknown as { early?: string | null }).early =
            document.documentElement.getAttribute('data-tx-mode');
      });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { early?: string }).early)).toBe('dark');
    await switcher
      .getByRole('radio', { name: 'System' })
      .or(switcher.getByRole('button', { name: 'System' }))
      .click();
    expect(await mode(page)).toBe('light');
    await page.reload();
    expect(await mode(page)).toBe('light');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on every page (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/', '/foundation/']) {
        await visit(page, path);
        expect(await mode(page)).toBe(scheme);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((violation) => `${path} ${violation.id}`)).toEqual([]);
      }
    });
  }
});
