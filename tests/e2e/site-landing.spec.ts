/// <reference types="node" />
/**
 * texuli.com home landing (FIX-site-landing): sections, keyboard CTAs and hero
 * widgets, no foreign requests, axe zero exclusions light/dark/forced-colors
 * on desktop Chromium and Pixel 7.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
] as const;

const MODES = ['light', 'dark', 'high-contrast'] as const;
type Mode = (typeof MODES)[number];

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

async function visit(page: Page, path = '/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

async function setMode(page: Page, mode: Mode) {
  await page.evaluate((next) => {
    const root = document.documentElement;
    if (next === 'high-contrast') {
      root.setAttribute('data-tx-mode', 'light');
      root.setAttribute('data-tx-forced-colors', 'true');
      root.style.colorScheme = 'light';
    } else {
      root.removeAttribute('data-tx-forced-colors');
      root.setAttribute('data-tx-mode', next);
      root.style.colorScheme = next;
    }
  }, mode);
  // Controls cross-fade their colors (`--tx-motion-base`, 200ms) when the mode
  // changes, like a click on the site switch. Contrast is checked on the
  // settled page, once every color transition has finished.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState === 'finished'
      )
  );
}

test.describe('texuli.com landing', () => {
  test('sections, CTAs and hero widgets are present and keyboard-reachable', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    await expect(page).toHaveTitle('Texuli');

    // A minimal landing (T-site-ia): no announcement banner or themes strip.
    await expect(page.getByRole('complementary', { name: 'Announcement' })).toHaveCount(0);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Interfaces from texels.' })
    ).toBeVisible();
    const start = page.getByRole('link', { name: 'Start building' });
    const browse = page.getByRole('link', { name: 'Browse components' });
    await expect(start).toBeVisible();
    await expect(browse).toBeVisible();
    await start.focus();
    await expect(start).toBeFocused();
    await browse.focus();
    await expect(browse).toBeFocused();

    await expect(page.getByRole('heading', { level: 2, name: 'Live moments' })).toBeVisible();
    await expect(page.locator('[data-moment="media"]')).toBeVisible();
    await expect(page.locator('[data-moment="thermostat"]')).toBeVisible();
    await expect(page.locator('[data-moment="team"]')).toBeVisible();
    await expect(page.locator('[data-moment="tasks"]')).toBeVisible();
    await expect(page.locator('[data-moment="chart"]')).toBeVisible();
    await expect(page.locator('[data-moment="date"]')).toBeVisible();

    // Keyboard-operate hero controls.
    test.setTimeout(90_000);
    const volume = page.getByRole('slider', { name: /volume/i });
    await volume.focus();
    await expect(volume).toBeFocused();
    await page.keyboard.press('ArrowRight');

    const mute = page.getByRole('button', { name: /mute/i });
    await mute.focus();
    await page.keyboard.press('Enter');

    const temp = page.getByRole('spinbutton', { name: /temperature/i });
    await temp.focus();
    await page.keyboard.press('ArrowUp');

    // ToggleGroup items expose as buttons (toggle pattern).
    const cool = page.getByRole('button', { name: 'Cool', exact: true });
    await cool.focus();
    await page.keyboard.press('Enter');

    const taskTab = page.getByRole('tab', { name: /this week/i });
    await taskTab.focus();
    await page.keyboard.press('Enter');
    await expect(taskTab).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByRole('heading', { level: 2, name: 'Why Texuli' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /agents can ship UI safely/i })
    ).toBeVisible();
    // The agents playground hydrates when it scrolls into view.
    const agents = page.locator('[data-tx-landing-agents]');
    await agents.scrollIntoViewIfNeeded();
    await agents.locator('astro-island:not([ssr])').waitFor();
    const open = agents.getByRole('button', { name: 'Open', exact: true });
    await open.click();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();

    // Minimal landing (T-site-ia): the themes strip lives in the theme docs now.
    await expect(page.getByRole('heading', { level: 2, name: /Themes that stay/i })).toHaveCount(0);

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'llms.txt' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Agent skill' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Changelog' })).toBeVisible();
    await expect(footer.getByText(/Dailybot, Inc/)).toBeVisible();

    // Illustration slots use fallback until art lands.
    await expect(page.locator('[data-tx-illustration="hero-bg"]')).toHaveAttribute(
      'data-tx-illustration-ready',
      'fallback'
    );
  });

  test('changelog page is reachable', async ({ page }) => {
    expect(await visit(page, '/changelog/')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
  });

  for (const mode of MODES) {
    test(`axe zero exclusions on / (${mode})`, async ({ page }, info) => {
      const mobile = info.project.name.includes('mobile');
      if (mobile && mode !== 'light') test.skip();
      expect(await visit(page, '/')).toEqual([]);
      await setMode(page, mode);
      const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});
