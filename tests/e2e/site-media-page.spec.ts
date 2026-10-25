/// <reference types="node" />
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * texuli.com media lab: image / video / audio / composition + browser export.
 * Built static site only (`pnpm build` first). No foreign network; axe light/dark.
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
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'media-page', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing media-page).');
  }
  if (!existsSync(join(DIST, 'media-lab', 'harbor.svg'))) {
    throw new Error('Missing dist/media-lab/harbor.svg — public assets not copied.');
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

async function visit(page: Page, path = '/media-page/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    // Same-origin static files only. blob: is in-memory (synthetic audio/export).
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (!url.startsWith(origin)) foreign.push(url);
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

const modeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test.describe('texuli.com media lab', () => {
  test('shows image, video, audio and composition export without foreign network', async ({
    page,
  }) => {
    const foreign = await visit(page);
    expect(foreign).toEqual([]);
    await expect(page).toHaveTitle(/Media lab/);
    await expect(page.getByRole('heading', { level: 1, name: 'Media lab' })).toBeVisible();

    await expect(page.locator('#lab-image')).toBeVisible();
    await expect(page.locator('#lab-video')).toBeVisible();
    await expect(page.locator('#lab-audio')).toBeVisible();
    await expect(page.locator('#lab-composition')).toBeVisible();

    await expect(page.locator('[data-composition-preview]')).toBeVisible();
    const exportGroup = page.getByRole('group', { name: /Export the harbor poster/i });
    await expect(exportGroup).toBeVisible();
    await expect(exportGroup.getByRole('button', { name: /png/i })).toBeVisible();
    await expect(exportGroup.getByRole('button', { name: /svg/i })).toBeVisible();
    // WebM button when animation is provided (may be disabled if recorder missing).
    await expect(exportGroup.getByRole('button', { name: /webm/i })).toBeVisible();

    // Local illustration served from the static host.
    const img = page.locator('#lab-image img').first();
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src ?? '').toMatch(/media-lab\/harbor/);
  });

  test('exports a PNG from the composition in the browser', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'download assertion once on chromium');
    await visit(page);
    const exportGroup = page.getByRole('group', { name: /Export the harbor poster/i });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      exportGroup.getByRole('button', { name: /png/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    const status = page
      .locator('[data-export-log], [role="status"]')
      .filter({ hasText: /\.png|Saved/i });
    await expect(status.first()).toBeVisible({ timeout: 15_000 });
  });

  test('records a real WebM with the fixed native MediaRecorder profile', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'native WebM recording is verified on Chromium'
    );
    const foreign = await visit(page);
    const exportGroup = page.getByRole('group', { name: /Export the harbor poster/i });
    const button = exportGroup.getByRole('button', { name: /webm/i });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      button.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.webm$/i);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const bytes = readFileSync(downloadPath as string);
    expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /\.webm|Saved/i })
        .first()
    ).toBeVisible();
    expect(foreign).toEqual([]);
  });

  test('is static: no foreign requests', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the media lab (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      // Align document mode with the scheme for chrome contrast.
      await page.evaluate((mode) => {
        const root = document.documentElement;
        root.dataset.txMode = mode;
        root.classList.toggle('dark', mode === 'dark');
        root.classList.toggle('light', mode === 'light');
        root.style.colorScheme = mode;
      }, scheme);
      expect(await modeAttr(page)).toBe(scheme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }
});
