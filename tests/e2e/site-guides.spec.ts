/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * Guides (apps/website/src/pages/guides): static docs with live Texuli snippets.
 * Served from dist like a static host. No foreign origin; axe in light and dark.
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

const GUIDE_PATHS = [
  '/guides/',
  '/guides/getting-started/',
  '/guides/why-svelte-kotlin/',
  '/guides/theming/',
  '/guides/dark-mode/',
  '/guides/accessibility/',
  '/guides/rtl-i18n/',
  '/guides/forms/',
  '/guides/performance/',
] as const;

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

/** Center the target under scroll-padding so the sticky header does not intercept. */
async function tap(locator: ReturnType<Page['locator']>) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((node) => {
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await locator.click();
}

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test.describe('texuli.com guides', () => {
  test('sidebar marks the current page and pager walks the reading order', async ({ page }) => {
    expect(await visit(page, '/guides/')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Guides' })).toBeVisible();
    await expect(page.locator('[data-tx-guides-shell]')).toBeVisible();

    // The guides are the site sidebar's "Get started" group (T-site-ia).
    const current = (await primaryNav(page)).locator('a[aria-current="page"]');
    await expect(current).toHaveText('Introduction');
    if (await page.locator('[data-site-menu]').isVisible()) await page.keyboard.press('Escape');

    const pager = page.getByRole('navigation', { name: 'Previous and next pages' });
    await tap(pager.getByRole('link', { name: /Getting started/i }));
    await expect(page).toHaveURL(`${origin}/guides/getting-started/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();

    // Why Svelte and Kotlin sits in Start between Getting started and
    // Theming (guides/nav.ts): the pager walks the reading order through it.
    await tap(pager.getByRole('link', { name: /Why Svelte and Kotlin/i }));
    await expect(page).toHaveURL(`${origin}/guides/why-svelte-kotlin/`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Why Svelte and Kotlin' })
    ).toBeVisible();

    await tap(pager.getByRole('link', { name: /Theming/i }));
    await expect(page).toHaveURL(`${origin}/guides/theming/`);
  });

  test('live snippets mount and respond', async ({ page }) => {
    expect(await visit(page, '/guides/getting-started/')).toEqual([]);
    const live = page.locator('[data-guide-live="getting-started"]');
    await expect(live).toBeVisible();
    await tap(live.getByRole('button', { name: 'Try the button' }));
    await expect(live.getByRole('button', { name: /Clicked 1/ })).toBeVisible();

    await visit(page, '/guides/forms/');
    const formLive = page.locator('[data-guide-live="forms"]');
    await expect(formLive).toBeVisible();
    await tap(formLive.getByRole('button', { name: 'Save profile' }));
    await expect(formLive.getByText('Enter at least two characters.')).toBeVisible();
    await formLive.getByLabel('Display name').fill('Alex');
    await formLive.getByLabel('Email').fill('alex@example.com');
    await tap(formLive.getByRole('button', { name: 'Save profile' }));
    await expect(formLive.locator('[data-guide-form-saved]')).toBeVisible();

    await visit(page, '/guides/rtl-i18n/');
    const rtl = page.locator('[data-guide-live="rtl-i18n"]');
    await expect(rtl.locator('[data-guide-dir="rtl"]')).toBeVisible();
    await tap(rtl.getByRole('button', { name: 'LTR' }));
    await expect(rtl.locator('[data-guide-dir="ltr"]')).toBeVisible();
  });

  test('"On this page" targets in-page headings', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', '"On this page" shows on wide screens.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, '/guides/');
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc.locator('a[href="#what-you-get"]')).toHaveCount(1);
    await expect(page.locator('#what-you-get')).toBeVisible();
    expect(await visit(page, '/guides/#what-you-get')).toEqual([]);
  });

  test('the phone drawer lists the guides without foreign requests', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Narrow viewport menu.');
    const foreign = await visit(page, '/guides/getting-started/');
    expect(foreign).toEqual([]);
    const nav = await primaryNav(page);
    await nav.getByRole('link', { name: 'Forms', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/guides/forms/`);
  });

  test('is edit-free, stays on origin, and ships every guide path', async ({ page }) => {
    for (const path of GUIDE_PATHS) {
      expect(await visit(page, path)).toEqual([]);
      await expect(page.locator('[data-tx-guides-shell]')).toBeVisible();
      await expect(page.getByRole('link', { name: /edit on github/i })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /edit this page/i })).toHaveCount(0);
    }
  });

  // One test per page and scheme, like a11y-site.spec.ts: a guide page with
  // live islands takes a good share of the test timeout to load and sweep, so
  // several pages do not fit inside one test.
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of GUIDE_PATHS) {
      test(`passes axe on ${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await visit(page, path);
        expect(await mode(page)).toBe(scheme);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
});
