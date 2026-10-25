/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { enterDocsFromLanding, primaryNav } from './support/site-nav.ts';

/*
 * Theme studio on texuli.com: generate, tune, AA, export, image path.
 * Static dist only. TEXULI_E2E_PORT for the lane.
 * No force clicks — sticky header + scroll-padding-top keep controls clear.
 */

const DIST = resolve('apps/website/dist');
const FIXTURE_IMAGE = resolve('tests/fixtures/theme-studio-seed.png');
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

const PATH = '/theme-studio/';

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'theme-studio', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /theme-studio/).');
  }
  if (!existsSync(FIXTURE_IMAGE)) {
    throw new Error('Missing tests/fixtures/theme-studio-seed.png');
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

/** Local-only schemes (file object URLs) are not foreign network. */
function isForeign(url: string, pageOrigin: string): boolean {
  if (url.startsWith(pageOrigin)) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;
  return true;
}

async function visit(page: Page, path: string) {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (isForeign(request.url(), origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  // Wait for the header script to publish a measured pixel height.
  await page.waitForFunction(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--site-header-height')
      .trim();
    return /px$/i.test(raw);
  });
  return foreign;
}

/**
 * Scroll the target into the padded viewport and click without force.
 * Uses a point below the sticky header so Playwright's hit-test stays clear.
 */
async function tap(locator: Locator, page: Page) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((node) => {
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  const box = await locator.boundingBox();
  if (!box) {
    await locator.click();
    return;
  }
  const headerBottom = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    return header ? header.getBoundingClientRect().bottom : 0;
  });
  const x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  if (y < headerBottom + 4) {
    y = Math.min(box.y + box.height - 4, headerBottom + 12);
  }
  await page.mouse.click(x, y);
}

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

/** True when the focused element's top edge is below the sticky header bottom. */
async function focusedClearOfHeader(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const active = document.activeElement;
    if (!header || !active || active === document.body || active === document.documentElement) {
      return true;
    }
    const headerBottom = header.getBoundingClientRect().bottom;
    const top = active.getBoundingClientRect().top;
    // Allow 1px subpixel slack.
    return top >= headerBottom - 1;
  });
}

test.describe('texuli.com theme studio', () => {
  test('loads the studio without foreign network requests', async ({ page }) => {
    expect(await visit(page, PATH)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Theme studio' })).toBeVisible();
    await expect(page.locator('[data-tx-theme-studio]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Source' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Live components' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
    await expect(page.locator('[data-tx-studio-preview]')).toBeVisible();
    await expect(page.locator('[data-tx-studio-kit]')).toBeVisible();
  });

  test('generates from color and shows AA status plus CSS export', async ({ page }) => {
    expect(await visit(page, PATH)).toEqual([]);
    await page.getByLabel('Brand color').fill('#0f766e');
    await tap(page.getByRole('button', { name: 'Generate theme' }), page);
    await expect(page.locator('[data-tx-studio-status]')).toContainText(/Theme ready|pairs|AA/i, {
      timeout: 15_000,
    });
    await expect(page.locator('[data-tx-studio-aa]')).toBeVisible();
    await expect(page.locator('[data-tx-studio-export]')).toContainText('--tx-primary');
  });

  test('switches to words source and generates from mood', async ({ page }) => {
    expect(await visit(page, PATH)).toEqual([]);
    await tap(
      page.getByRole('group', { name: 'Theme source' }).getByRole('button', { name: 'Words' }),
      page
    );
    await page.getByLabel('Mood words').fill('calm ocean');
    await tap(page.getByRole('button', { name: 'Generate theme' }), page);
    await expect(page.locator('[data-tx-studio-status]')).toContainText(/Theme ready|pairs|AA/i, {
      timeout: 15_000,
    });
    await expect(page.locator('[data-tx-studio-error]')).toHaveCount(0);
  });

  test('generates from a local image without foreign network requests', async ({ page }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      if (isForeign(request.url(), origin)) foreign.push(request.url());
    });
    await page.goto(`${origin}${PATH}`);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--site-header-height')
        .trim();
      return /px$/i.test(raw);
    });

    await tap(
      page.getByRole('group', { name: 'Theme source' }).getByRole('button', { name: 'Image' }),
      page
    );
    await page.locator('[data-tx-studio-image]').setInputFiles(FIXTURE_IMAGE);
    await expect(page.locator('[data-tx-studio-image-note]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-tx-studio-status]')).toContainText(
      /Theme from image|pairs|AA/i,
      {
        timeout: 15_000,
      }
    );
    await expect(page.locator('[data-tx-studio-export]')).toContainText('--tx-primary');
    expect(foreign).toEqual([]);
  });

  test('toggles export format to JSON', async ({ page }) => {
    expect(await visit(page, PATH)).toEqual([]);
    await tap(
      page.getByRole('group', { name: 'Export format' }).getByRole('button', { name: 'JSON' }),
      page
    );
    await expect(page.locator('[data-tx-studio-export]')).toContainText('"id"', {
      timeout: 10_000,
    });
    await expect(page.locator('[data-tx-studio-export]')).toContainText('theme-studio');
  });

  test('primary nav links to theme studio', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    await enterDocsFromLanding(page);
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Studio', exact: true })).toBeVisible();
    await tap(primary.getByRole('link', { name: 'Studio', exact: true }), page);
    await expect(page).toHaveURL(`${origin}/theme-studio/`);
  });

  test('stays on origin', async ({ page }) => {
    expect(await visit(page, PATH)).toEqual([]);
  });

  test('tabbing through the studio never leaves focus under the sticky header (Pixel 7)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Focus-not-obscured check on Pixel 7 only.');
    test.setTimeout(90_000);
    expect(await visit(page, PATH)).toEqual([]);
    await expect(page.locator('[data-tx-theme-studio]')).toBeVisible();

    // Start from the skip link path into main, then tab through studio controls.
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    if (await skip.isVisible()) {
      await page.keyboard.press('Enter');
    }

    const obscured: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const studio = document.querySelector('[data-tx-theme-studio]');
        const active = document.activeElement;
        return Boolean(studio && active && studio.contains(active));
      });
      if (!inside) {
        // Left the studio (footer/nav) — stop once we have sampled studio focus.
        if (i > 5) break;
        continue;
      }
      const clear = await focusedClearOfHeader(page);
      if (!clear) {
        const name = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return (
            el?.getAttribute('aria-label') || el?.textContent?.trim().slice(0, 40) || el?.tagName
          );
        });
        obscured.push(String(name));
      }
    }
    expect(obscured).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the theme studio (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, PATH);
      expect(await mode(page)).toBe(scheme);
      await expect(page.locator('[data-tx-studio-kit]')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${scheme} ${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
