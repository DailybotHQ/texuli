/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com brand + home (apps/website): built static site, live Texuli
 * components in the brand story, axe in light/dark on desktop and Pixel 7.
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

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test.describe('texuli.com brand and home', () => {
  test('home landing shows the platform hero and the unified sections', async ({ page }) => {
    // The unified landing since T-44 (narrative blueprint §5); the section
    // order and every call to action are asserted in site-landing.spec.ts.
    expect(await visit(page, '/')).toEqual([]);
    await expect(page).toHaveTitle('One component catalog for web and native · Texuli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Interfaces from texels.' })
    ).toBeVisible();
    const hero = page.locator('[data-tx-web-hero]');
    await expect(hero.getByRole('link', { name: 'Start building' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'See the native story' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Why Svelte for the web' })
    ).toBeVisible();
    await expect(page.locator('[data-tx-landing-moments]')).toHaveCount(0);
  });

  test('brand page deepens the story and marks navigation', async ({ page }) => {
    expect(await visit(page, '/brand/')).toEqual([]);
    await expect(page).toHaveTitle('Brand · Texuli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Small pieces. Infinite possibilities.' })
    ).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Brand', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://texuli.com/brand/'
    );
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
  });

  test('is static on home and brand: no foreign network', async ({ page }) => {
    for (const path of ['/', '/brand/']) {
      expect(await visit(page, path)).toEqual([]);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on home and brand (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/', '/brand/']) {
        await visit(page, path);
        expect(await mode(page)).toBe(scheme);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map((violation) => `${path} ${violation.id}: ${violation.help}`)
        ).toEqual([]);
      }
    });
  }
});
