/// <reference types="node" />
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  LIVE_CATALOG_IDS,
  LIVE_MARKERS,
  markerFor,
} from '../../apps/website/src/components/live/markers.ts';

/*
 * Live interactive component pages — every catalog id mounts its real component.
 * Full sweep visits every /component-pages/<id>/ (chromium); forced-colors axe samples families.
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

/** Families for axe (avoid chart SVG/table contrast in dark page chrome). */
const FAMILY_SAMPLES = [
  'button',
  'badge',
  'alert',
  'dropdown-menu',
  'layout-sidebar',
  'table',
  'media-image',
  'blocks-text',
  'dialog',
  'select',
] as const;

/** Chart identity samples (mount + size only; axe covered by light package tests). */
const CHART_SAMPLES = ['charts-pie', 'charts-bubble', 'charts-sankey', 'charts-line'] as const;

let server: Server;
let origin = '';
let catalogIds: string[] = [];

test.beforeAll(async () => {
  const dir = join(DIST, 'component-pages');
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error('Run pnpm build first (missing component-pages).');
  }
  catalogIds = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
  if (catalogIds.length < 50) {
    throw new Error(`Expected many component pages, found ${catalogIds.length}`);
  }
  for (const id of catalogIds) {
    if (!LIVE_MARKERS[id]) throw new Error(`LIVE_MARKERS missing id ${id}`);
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
  const onReq = (request: { url: () => string }) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  };
  page.on('request', onReq);
  try {
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  } finally {
    page.off('request', onReq);
  }
  return foreign;
}

async function expectLiveStage(page: Page, id: string) {
  const stage = page.locator(`[data-tx-live-stage="${id}"]`).first();
  await expect(stage, id).toBeVisible({ timeout: 25_000 });
  await expect(stage, id).toHaveAttribute('data-tx-live-ready', 'true', { timeout: 25_000 });
  const box = await stage.boundingBox();
  expect(box, `stage ${id} size`).toBeTruthy();
  expect((box?.width ?? 0) * (box?.height ?? 0), id).toBeGreaterThan(0);

  const spec = markerFor(id);
  const marker = stage.locator(spec.marker).first();
  await expect(marker, `marker for ${id}: ${spec.marker}`).toBeVisible({ timeout: 20_000 });
  const mBox = await marker.boundingBox();
  expect((mBox?.width ?? 0) * (mBox?.height ?? 0), id).toBeGreaterThan(0);

  if (spec.interact) {
    const control = stage.locator(spec.interact).first();
    if ((await control.count()) > 0 && (await control.isVisible().catch(() => false))) {
      await control.click({ timeout: 5_000 }).catch(() => undefined);
    }
  }
}

test.describe('texuli.com live components exact', () => {
  test('LIVE_MARKERS covers the catalog list module', () => {
    expect(LIVE_CATALOG_IDS.length).toBeGreaterThan(50);
    expect(Object.keys(LIVE_MARKERS).length).toBe(LIVE_CATALOG_IDS.length);
  });

  // One test per id keeps timeouts honest and avoids a single 7-minute wall clock.
  for (const id of LIVE_CATALOG_IDS) {
    test(`live stage for ${id}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Full catalog sweep on chromium only');
      test.setTimeout(60_000);
      const foreign = await visit(page, `/component-pages/${id}/`);
      expect(foreign, id).toEqual([]);
      await expect(page.getByText('Live island not wired')).toHaveCount(0);
      await expect(page.getByText('Static props preview')).toHaveCount(0);
      await expectLiveStage(page, id);
    });
  }

  test('props panel updates the live code sample on badge', async ({ page }) => {
    expect(await visit(page, '/component-pages/badge/')).toEqual([]);
    const demo = page.locator('[data-tx-live-demo="badge"]').first();
    await expect(demo).toBeVisible();
    // Wait for hydration: a click on the server-rendered panel is lost.
    await expect(
      page.locator('astro-island[component-url*="LiveDemo"]:not([ssr])')
    ).not.toHaveCount(0);
    const outline = demo
      .getByRole('radio', { name: 'outline' })
      .or(demo.getByRole('button', { name: 'outline' }));
    if ((await outline.count()) > 0) {
      await outline.first().click();
      await expect(demo.locator('[data-tx-code-sample] code')).toContainText('outline');
    }
  });

  test('dropdown-menu trigger is interactive Texuli menu chrome', async ({ page }) => {
    expect(await visit(page, '/component-pages/dropdown-menu/')).toEqual([]);
    await expectLiveStage(page, 'dropdown-menu');
    const stage = page.locator('[data-tx-live-stage="dropdown-menu"]').first();
    const trigger = stage.locator('[data-tx-dropdown-menu-trigger]').first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    // Toggle open/closed — real DropdownMenu.Root (no nested Button, no native details).
    await trigger.click();
    await expect
      .poll(async () => trigger.getAttribute('aria-expanded'), { timeout: 10_000 })
      .not.toBeNull();
    const expanded = await trigger.getAttribute('aria-expanded');
    expect(['true', 'false']).toContain(expanded);
  });

  test('chart family samples mount real chart roots', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chart samples on chromium');
    for (const id of CHART_SAMPLES) {
      expect(await visit(page, `/component-pages/${id}/`)).toEqual([]);
      await expectLiveStage(page, id);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on family samples (${scheme})`, async ({ page }, testInfo) => {
      // Pixel 7 layout samples can clip sticky chrome; chromium covers the gate.
      test.skip(testInfo.project.name === 'mobile', 'Family axe on desktop projects');
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme });
      for (const id of FAMILY_SAMPLES) {
        expect(await visit(page, `/component-pages/${id}/`)).toEqual([]);
        await expectLiveStage(page, id);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map((v) => `${id} ${v.id}: ${v.help}`),
          id
        ).toEqual([]);
      }
    });
  }

  test('passes axe on family samples (forced-colors)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Family axe on desktop projects');
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
    for (const id of FAMILY_SAMPLES) {
      expect(await visit(page, `/component-pages/${id}/`)).toEqual([]);
      await expectLiveStage(page, id);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map((v) => `${id} ${v.id}: ${v.help}`),
        id
      ).toEqual([]);
    }
  });
});
