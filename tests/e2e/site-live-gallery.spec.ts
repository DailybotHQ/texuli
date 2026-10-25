/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Frame, type FrameLocator, type Page, test } from '@playwright/test';
import { COMPONENT_PAGES } from '../../apps/website/src/components/component-pages/load-manifests.ts';

/*
 * texuli.com living component gallery (T-site-live-gallery): every catalog
 * card mounts its real component in an isolated preview that loads when it
 * scrolls near; category, tag and search filters; light/dark and RTL per
 * preview; a props panel that drives the preview and the code; overlays that
 * open by pointer and keyboard; axe with zero exclusions (frames included)
 * in light, dark and forced colors. Run `pnpm build` first.
 */

const DIST = resolve('apps/website/dist');
const GALLERY = '/gallery-components/';
/** One card per catalog component (read from the catalog, never a literal). */
const CARD_COUNT = COMPONENT_PAGES.length;
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'gallery-components', 'preview', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing the gallery preview page).');
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

/** Opens the gallery; returns the off-origin requests the page (and its frames) made. */
async function visit(page: Page, path = GALLERY): Promise<string[]> {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      foreign.push(url);
    }
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

const card = (page: Page, id: string) => page.locator(`[data-tx-gallery-card="${id}"]`);
const preview = (page: Page, id: string): FrameLocator =>
  page.frameLocator(`[data-tx-preview-frame="${id}"]`);

/** Scrolls a card's preview into view and waits until its stage has mounted. */
async function showPreview(page: Page, id: string): Promise<FrameLocator> {
  // The slot exists from first paint; its iframe is created as it nears view.
  await page.locator(`[data-tx-preview-slot="${id}"]`).scrollIntoViewIfNeeded();
  const frame = page.locator(`[data-tx-preview-frame="${id}"]`);
  await expect(frame).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
  const stage = preview(page, id).locator(`[data-tx-live-stage="${id}"]`);
  await expect(stage).toBeVisible();
  await expect(stage.getByText(/^Loading (demo|chart|blocks|layout)/)).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(
    stage.getByRole('alert').filter({ hasText: /failed|No live stage|invalid/ })
  ).toHaveCount(0);
  return preview(page, id);
}

/** Loads every preview on the page, one scroll step at a time. */
async function showAll(page: Page): Promise<string[]> {
  const ids = await page
    .locator('[data-tx-gallery-card]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tx-gallery-card') ?? ''));
  for (const id of ids) await showPreview(page, id);
  return ids;
}

function frameFor(page: Page, id: string): Frame {
  // Exact `id` match: `id=alert` must not pick the `id=alert-dialog` preview.
  const frame = page
    .frames()
    .find((f) => f.url() !== '' && new URL(f.url()).searchParams.get('id') === id);
  if (!frame) throw new Error(`No preview frame for ${id}`);
  return frame;
}

test.describe('texuli.com living component gallery', () => {
  // Each test loads many preview documents: run them one at a time so a
  // busy machine does not starve a preview of the time to report ready.
  test.describe.configure({ mode: 'serial' });

  test('lazily mounts a real, working preview in every card', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'the full sweep runs once; the others sample');
    test.setTimeout(600_000);
    expect(await visit(page)).toEqual([]);
    await expect(page.locator('[data-tx-gallery-card]')).toHaveCount(CARD_COUNT);

    // Lazy: on open, only the previews near the first screen have an iframe.
    await expect(page.locator('[data-tx-preview-slot]')).toHaveCount(CARD_COUNT);
    const loadedAtOpen = await page.locator('[data-tx-preview-frame]').count();
    expect(loadedAtOpen).toBeLessThan(10);

    const ids = await showAll(page);
    expect(ids).toHaveLength(CARD_COUNT);
    await expect(page.locator('[data-tx-preview-frame][data-loaded="true"]')).toHaveCount(
      CARD_COUNT
    );
    // Every stage is a real component family; no static stand-in copy anywhere.
    for (const id of ids) {
      const family = await preview(page, id)
        .locator(`[data-tx-live-stage="${id}"]`)
        .getAttribute('data-family');
      expect(family, id).toBeTruthy();
    }
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      expect(await frame.locator('[data-tx-gallery-preview], .preview--empty').count()).toBe(0);
    }
  });

  test('filters by category, tag and search', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    const cards = page.locator('[data-tx-gallery-card]');
    await expect(cards).toHaveCount(CARD_COUNT);

    await page
      .getByRole('group', { name: 'Category', exact: true })
      .getByRole('button', { name: 'overlays', exact: true })
      .click();
    const categories = await cards.evaluateAll((nodes) => [
      ...new Set(nodes.map((n) => n.getAttribute('data-category'))),
    ]);
    expect(categories).toEqual(['overlays']);
    await page
      .getByRole('group', { name: 'Category', exact: true })
      .getByRole('button', { name: 'All', exact: true })
      .click();

    await page
      .getByRole('group', { name: 'Tag', exact: true })
      .getByRole('button', { name: '@texuli/charts', exact: true })
      .click();
    const charts = await cards.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-tx-gallery-card') ?? '')
    );
    expect(charts.length).toBeGreaterThan(10);
    expect(charts.every((id) => id.startsWith('charts-'))).toBe(true);
    await page
      .getByRole('group', { name: 'Tag', exact: true })
      .getByRole('button', { name: 'All', exact: true })
      .click();

    // A tag chip on a card filters too, and pressing it again clears the filter.
    const chip = card(page, 'badge').getByRole('button', { name: 'display' });
    await chip.click();
    await expect(page.locator('[data-tx-gallery-card="tag"]')).toBeVisible();
    expect(await cards.count()).toBeLessThan(CARD_COUNT);
    await card(page, 'badge').getByRole('button', { name: 'display' }).click();
    await expect(cards).toHaveCount(CARD_COUNT);

    await page.getByLabel('Search').fill('sparkline');
    await expect(card(page, 'charts-sparkline')).toBeVisible();
    expect(await cards.count()).toBeLessThan(5);
  });

  test('switches one preview to dark and to right to left', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await visit(page)).toEqual([]);
    await showPreview(page, 'alert');
    const frame = frameFor(page, 'alert');
    expect(await frame.locator('html').getAttribute('data-tx-mode')).toBe('light');

    const tools = card(page, 'alert').locator('[data-tx-demo-frame]');
    await tools.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(frame.locator('html')).toHaveAttribute('data-tx-mode', 'dark', {
      timeout: 15_000,
    });
    // Dark must look dark: the preview's background is a dark color.
    const lightness = await frame.locator('body').evaluate((body) => {
      const [r, g, b] = (getComputedStyle(body).backgroundColor.match(/\d+/g) ?? []).map(Number);
      return ((r ?? 255) + (g ?? 255) + (b ?? 255)) / 3;
    });
    expect(lightness).toBeLessThan(80);
    // The rest of the page keeps its own mode.
    expect(await page.locator('html').getAttribute('data-tx-mode')).toBe('light');

    await tools.getByRole('button', { name: 'RTL', exact: true }).click();
    await expect(frame.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 15_000 });
    await tools.getByRole('button', { name: 'LTR', exact: true }).click();
    await expect(frame.locator('html')).toHaveAttribute('dir', 'ltr', { timeout: 15_000 });
  });

  test('the props panel drives the preview and the code sample', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    const live = await showPreview(page, 'button');
    const button = card(page, 'button');
    await button.getByRole('button', { name: 'Props and code' }).click();
    const panel = button.locator('[data-tx-props-panel]');
    await expect(panel).toBeVisible();

    // enum -> segmented control
    await panel.getByRole('button', { name: 'outline', exact: true }).first().click();
    await expect(live.getByRole('button', { name: 'Save note' })).toHaveAttribute(
      'data-variant',
      'outline'
    );
    await expect(button.locator('[data-tx-code-sample] code')).toContainText('variant="outline"');
    await expect(button.locator('[data-tx-code-sample] code')).toContainText(
      "import { Button } from 'texuli/button';"
    );
    // boolean -> switch
    await panel.getByRole('switch', { name: 'disabled' }).click();
    await expect(live.getByRole('button', { name: 'Save note' })).toBeDisabled();
    await expect(button.locator('[data-tx-code-sample] code')).toContainText('disabled');

    // string -> input
    const alert = card(page, 'alert');
    const alertLive = await showPreview(page, 'alert');
    await alert.getByRole('button', { name: 'Props and code' }).click();
    const title = alert.locator('[data-tx-props-panel]').getByRole('textbox').first();
    await title.fill('Restock today');
    await expect(alertLive.getByText('Restock today')).toBeVisible();
    await expect(alert.locator('[data-tx-code-sample] code')).toContainText(
      'title="Restock today"'
    );

    // number -> number field
    const pagination = card(page, 'pagination');
    const pages = await showPreview(page, 'pagination');
    await pagination.getByRole('button', { name: 'Props and code' }).click();
    const count = pagination.locator('[data-tx-props-panel] input[type="number"]').nth(1);
    await count.fill('3');
    await expect(pages.getByRole('button', { name: /3/ }).first()).toBeVisible();
    await expect(pages.getByRole('button', { name: /^(Page )?12$/ })).toHaveCount(0);
  });

  test('overlays open by click and by keyboard, and close with Escape', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    const dialog = await showPreview(page, 'dialog');
    await dialog.getByRole('button', { name: 'Edit note' }).click();
    await expect(dialog.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog.getByRole('dialog')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Edit note' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('status')).toContainText('Saved');

    const menu = await showPreview(page, 'dropdown-menu');
    const trigger = menu.getByRole('button', { name: 'Actions' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(menu.getByRole('menu')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu.getByRole('menu')).toHaveCount(0);
    await expect(menu.getByRole('status')).toContainText('Chose');

    const select = await showPreview(page, 'select');
    await select.getByRole('combobox').click();
    await select.getByRole('option', { name: /Team/ }).click();
    await expect(select.getByRole('status')).toContainText('team');

    const sheet = await showPreview(page, 'sheet');
    await sheet.getByRole('button', { name: 'Open filters' }).click();
    await expect(sheet.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet.getByRole('dialog')).toHaveCount(0);
  });

  test('forms in previews take typing', async ({ page }) => {
    expect(await visit(page)).toEqual([]);
    const input = await showPreview(page, 'input');
    const name = input.getByRole('textbox', { name: 'Full name' });
    await name.fill('Grace Example');
    await expect(name).toHaveValue('Grace Example');

    const form = await showPreview(page, 'form');
    await form.getByRole('button', { name: 'Save team' }).click();
    await expect(form.getByText('Enter a team name.')).toBeVisible();
    await form.getByRole('textbox', { name: /Team name/ }).fill('Harbor design');
    await form.getByRole('textbox', { name: /Contact email/ }).fill('ada@example.com');
    await form.getByRole('button', { name: 'Save team' }).click();
    await expect(form.getByRole('status')).toContainText('Saved team Harbor design');
  });

  test('full-page layouts render inert in the grid and open live in their own document', async ({
    page,
  }) => {
    expect(await visit(page)).toEqual([]);
    const live = await showPreview(page, 'layout-sidebar');
    const frame = page.locator('[data-tx-preview-frame="layout-sidebar"]');
    await expect(frame).toHaveAttribute('inert', '');
    await expect(frame).toHaveAttribute('aria-hidden', 'true');
    await expect(live.locator('main')).toHaveCount(1);
    const open = card(page, 'layout-sidebar').getByRole('link', { name: /Open the live layout/ });
    await open.click();
    await expect(page).toHaveURL(/\/gallery-components\/preview\/\?id=layout-sidebar/);
    await expect(page.locator('[data-tx-live-stage="layout-sidebar"] main')).toBeVisible();
  });

  for (const mode of ['light', 'dark', 'forced-colors'] as const) {
    test(`axe finds nothing in each full-page layout's own document (${mode})`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'chromium', 'layout documents are swept once');
      test.setTimeout(600_000);
      await page.emulateMedia({
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      expect(await visit(page)).toEqual([]);
      const links = await page
        .locator('[data-tx-open-preview]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tx-open-preview') ?? ''));
      expect(links.length).toBeGreaterThan(10);
      const found: string[] = [];
      for (const id of links) {
        const theme = mode === 'dark' ? 'dark' : 'light';
        await page.goto(`${origin}/gallery-components/preview/?id=${id}&mode=${theme}&dir=ltr`);
        await page.waitForFunction(
          () =>
            document.documentElement.dataset.txPageReady === 'true' ||
            (!document.querySelector('script[data-tx-ready-script]') &&
              document.readyState === 'complete'),
          undefined,
          { polling: 250 }
        );
        await expect(page.locator(`[data-tx-live-stage="${id}"]`)).toBeVisible();
        await expect(
          page.locator(`[data-tx-live-stage="${id}"]`).getByText(/^Loading (demo|layout)/)
        ).toHaveCount(0, { timeout: 20_000 });
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        for (const v of results.violations) {
          found.push(`${id} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        }
      }
      expect(found).toEqual([]);
    });
  }

  for (const mode of ['light', 'dark', 'forced-colors'] as const) {
    test(`axe finds nothing with every preview loaded (${mode})`, async ({ page }, info) => {
      test.setTimeout(900_000);
      await page.emulateMedia({
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      expect(await visit(page)).toEqual([]);
      if (info.project.name !== 'chromium') {
        // WebKit and the Pixel 7 sample one category of overlays and forms.
        await page
          .getByRole('group', { name: 'Category', exact: true })
          .getByRole('button', { name: 'forms', exact: true })
          .click();
      }
      await showAll(page);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
        )
      ).toEqual([]);
    });
  }
});
