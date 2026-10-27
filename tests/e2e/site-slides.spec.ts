/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * texuli.com slides area: the live DeckStage tour, the starter templates, the
 * slides examples, the docs and site navigation, and the showcase
 * cross-links. Built static site only (`pnpm build` first).
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
  if (!existsSync(join(DIST, 'slides-page', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing slides-page).');
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

async function visit(page: Page, path = '/slides-page/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (!url.startsWith(origin)) foreign.push(url);
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

const tour = (page: Page) => page.getByRole('region', { name: 'Presentation: Slides tour' });
const position = (page: Page) => tour(page).locator('[aria-live="polite"]');

/** Every same-origin page link resolves to a built page with the expected h1. */
async function expectPage(page: Page, href: string, heading: string | RegExp) {
  const url = new URL(href, origin);
  expect(url.origin).toBe(origin);
  // Leave first, so a link to an anchor on the current page is a real load.
  await page.goto('about:blank');
  const response = await page.goto(url.href);
  expect(response?.status(), href).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  if (url.hash) await expect(page.locator(url.hash)).toBeVisible();
}

test.describe('texuli.com slides area', () => {
  test('renders the area with its sections and no foreign network', async ({ page }) => {
    const foreign = await visit(page);
    expect(foreign).toEqual([]);
    await expect(page).toHaveTitle(/Slides/);
    await expect(page.getByRole('heading', { level: 1, name: 'Slides' })).toBeVisible();
    for (const name of [
      'Try the deck',
      'Starter templates',
      'More examples',
      'What ships',
      'Package docs',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(page.getByRole('heading', { level: 3, name: 'Planned' })).toBeVisible();
    await expect(page.getByText('packages/slides/docs/stage.md')).toBeVisible();
  });

  test('the live stage advances, reveals a step and opens the presenter view', async ({ page }) => {
    await visit(page);
    await expect(tour(page)).toBeVisible({ timeout: 30_000 });
    const controls = tour(page).getByRole('group', { name: 'Presentation controls' });
    await expect(controls.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
    await expect(position(page)).toHaveText('Slide 1 of 6: Slides tour');

    await controls.getByRole('button', { name: 'Next slide' }).click();
    await expect(position(page)).toHaveText('Slide 2 of 6: Reveal steps, 0 of 4 revealed');
    await expect(tour(page).getByText('Plan the pilot')).toBeHidden();

    await controls.getByRole('button', { name: 'Next step' }).click();
    await expect(position(page)).toHaveText('Slide 2 of 6: Reveal steps, 1 of 4 revealed');
    await expect(tour(page).getByText('Plan the pilot')).toBeVisible();
    await expect(tour(page).getByText('Open the beta')).toBeHidden();

    // Keyboard from inside the slide: Right reveals, Left hides again.
    await tour(page).getByRole('article', { name: 'Reveal steps' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tour(page).getByText('Open the beta')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(tour(page).getByText('Open the beta')).toBeHidden();

    await page.keyboard.press('p');
    const notes = tour(page).getByRole('complementary', { name: 'Speaker notes' });
    await expect(notes).toContainText('Reveal step 1 of 4');
    await expect(tour(page).getByRole('region', { name: 'Up next' })).toContainText(
      'Reveal step 2 of 4 on this slide'
    );
    await page.keyboard.press('Escape');
    await expect(notes).toHaveCount(0);
  });

  test('fullscreen opens natively or fills the window visibly, and Exit fullscreen closes it', async ({
    page,
  }) => {
    await visit(page);
    await expect(tour(page)).toBeVisible({ timeout: 30_000 });
    await tour(page).getByRole('button', { name: 'Fullscreen' }).click();
    await expect(tour(page)).toHaveAttribute('data-fullscreen', /^(native|viewport)$/);
    await tour(page).getByRole('button', { name: 'Exit fullscreen' }).click();
    await expect(tour(page)).not.toHaveAttribute('data-fullscreen', /.+/);
    await expect(tour(page).getByRole('button', { name: 'Fullscreen' })).toBeFocused();
  });

  test('template and example links resolve to their example pages', async ({ page }) => {
    await visit(page);
    const links = [
      { name: 'Open the slides tour example with its source', heading: 'Slides tour' },
      { name: 'Open the report template', heading: 'Report deck template' },
      { name: 'Open the pitch template', heading: 'Pitch deck template' },
      { name: 'Open the review template', heading: 'Review deck template' },
      { name: 'Reveal steps', heading: 'Reveal steps (fragments)' },
      { name: 'Presenter screen', heading: 'Presenter screen' },
      { name: 'Slot masters', heading: 'Slot masters (print view)' },
      { name: 'Media deck', heading: 'Media deck (print view)' },
    ];
    const hrefs: { href: string; heading: string }[] = [];
    for (const link of links) {
      const href = await page
        .getByRole('link', { name: link.name, exact: true })
        .getAttribute('href');
      expect(href, link.name).toBeTruthy();
      hrefs.push({ href: href as string, heading: link.heading });
    }
    for (const { href, heading } of hrefs) await expectPage(page, href, heading);
  });

  test('the site sidebar and the docs shell link to the slides area', async ({ page }) => {
    await visit(page, '/component-pages/');
    const sidebarLink = page.getByRole('link', { name: 'Slides', exact: true }).first();
    const sidebarHref = await sidebarLink.getAttribute('href');
    expect(sidebarHref).toMatch(/\/slides-page\/$/);

    await visit(page, '/docs-shell/');
    const docsLinks = [
      { name: 'Slides overview', heading: 'Slides' },
      { name: 'Slides package docs', heading: 'Slides' },
      { name: 'Slides tour example', heading: 'Slides tour' },
      { name: 'Slide deck showcase', heading: 'Slide deck' },
    ];
    const targets: { href: string; heading: string }[] = [];
    for (const link of docsLinks) {
      const href = await page
        .getByRole('link', { name: link.name, exact: true })
        .first()
        .getAttribute('href');
      expect(href, link.name).toBeTruthy();
      targets.push({ href: href as string, heading: link.heading });
    }
    for (const { href, heading } of targets) await expectPage(page, href, heading);
  });

  test('the slides area and the showcase screen link to each other', async ({ page }) => {
    await visit(page);
    const toShowcase = await page
      .getByRole('link', { name: 'slide deck showcase screen' })
      .getAttribute('href');
    await expectPage(page, toShowcase as string, 'Slide deck');
    const back = await page
      .getByRole('link', { name: 'Slides', exact: true })
      .last()
      .getAttribute('href');
    expect(back).toMatch(/\/slides-page\/$/);
    await expectPage(page, back as string, 'Slides');
  });

  test(`passes axe on the slides area in light and dark`, async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      await page.evaluate((mode) => {
        const root = document.documentElement;
        root.dataset.txMode = mode;
        root.classList.toggle('dark', mode === 'dark');
        root.classList.toggle('light', mode === 'light');
        root.style.colorScheme = mode;
      }, scheme);
      await expect(tour(page)).toBeVisible({ timeout: 30_000 });
      // Previews load as they scroll into view; settle them before checking.
      const hosts = page.locator('[data-tx-example-host]');
      for (let index = 0; index < (await hosts.count()); index += 1) {
        await hosts.nth(index).scrollIntoViewIfNeeded();
      }
      await expect(page.getByText('Scroll to load this example.')).toHaveCount(0, {
        timeout: 30_000,
      });
      await page.waitForFunction(() =>
        document.getAnimations().every((animation) => animation.playState !== 'running')
      );
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    }
  });
});
