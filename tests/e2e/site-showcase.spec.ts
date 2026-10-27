/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com showcase: complete interfaces (apps/website/src/pages/showcase).
 * Built static site only — run `pnpm build` first. No foreign network; axe in
 * light and dark on desktop Chromium and Pixel 7.
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

const SHOWCASE_PATHS = [
  '/showcase/',
  '/showcase/dashboard/',
  '/showcase/settings/',
  '/showcase/inbox/',
  '/showcase/kanban/',
  '/showcase/docs/',
  '/showcase/landing/',
  '/showcase/checkout/',
  '/showcase/media-studio/',
  '/showcase/slide-deck/',
] as const;

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec.');
  }
  if (!existsSync(join(DIST, 'showcase', 'index.html'))) {
    throw new Error('Showcase pages missing from dist — rebuild the website.');
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
  await page.waitForLoadState('networkidle');
  return foreign;
}

test.describe('texuli.com showcase', () => {
  test('index lists every screen and primary nav marks Showcase', async ({ page }) => {
    expect(await visit(page, '/showcase/')).toEqual([]);
    await expect(page).toHaveTitle('Showcase · Texuli');
    await expect(page.getByRole('heading', { level: 1, name: 'Showcase' })).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Showcase', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    for (const label of [
      'Dashboard',
      'Settings',
      'Inbox',
      'Kanban',
      'Docs',
      'Landing',
      'Checkout',
      'Media studio',
      'Slide deck',
    ]) {
      await expect(page.getByRole('link', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
  });

  test('each showcase screen renders its main landmark content', async ({ page }) => {
    const checks: { path: string; heading: string | RegExp }[] = [
      { path: '/showcase/dashboard/', heading: 'Dashboard' },
      { path: '/showcase/settings/', heading: 'Settings' },
      { path: '/showcase/inbox/', heading: 'Inbox' },
      { path: '/showcase/kanban/', heading: 'Kanban' },
      { path: '/showcase/docs/', heading: 'Docs' },
      { path: '/showcase/landing/', heading: 'Landing' },
      { path: '/showcase/checkout/', heading: 'Checkout' },
      { path: '/showcase/media-studio/', heading: 'Media studio' },
      { path: '/showcase/slide-deck/', heading: 'Slide deck' },
    ];
    for (const { path, heading } of checks) {
      expect(await visit(page, path), path).toEqual([]);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText('Static demo').first()).toBeVisible();
    }
  });

  test('showcase routes stay on-origin (no foreign network)', async ({ page }) => {
    for (const path of SHOWCASE_PATHS) {
      expect(await visit(page, path), path).toEqual([]);
    }
  });

  // axe on the showcase pages in light and dark (zero exclusions) runs in the page
  // sweep, a11y-site.spec.ts.
});
