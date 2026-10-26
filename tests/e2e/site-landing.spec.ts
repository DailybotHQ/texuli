/// <reference types="node" />
/**
 * texuli.com home (PLAN_006 T-44): the unified landing — four blueprint
 * sections in order, hero CTAs and the install copy interaction keyboard
 * reachable, the correlation demo real, no foreign requests, axe zero
 * exclusions light/dark/forced-colors on desktop Chromium and Pixel 7.
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
  test('the four sections mount in blueprint order and the CTAs work', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    await expect(page).toHaveTitle('Texuli');

    // A minimal landing (T-site-ia): no announcement banner.
    await expect(page.getByRole('complementary', { name: 'Announcement' })).toHaveCount(0);

    // Blueprint order (T-44): hero → why Svelte → correlation → agents+CTA,
    // read as document order of the four section landmarks.
    const order = await page.$$eval(
      '[data-tx-web-hero], [data-tx-web-why-svelte], [data-tx-web-correlation], [data-tx-web-agents]',
      (sections) =>
        sections.map((section) => {
          const attributes = Array.from(section.attributes).map((attribute) => attribute.name);
          if (attributes.includes('data-tx-web-hero')) return 'hero';
          if (attributes.includes('data-tx-web-why-svelte')) return 'why';
          if (attributes.includes('data-tx-web-correlation')) return 'correlation';
          return 'agents';
        })
    );
    expect(order).toEqual(['hero', 'why', 'correlation', 'agents']);

    // Hero: earned h1, platform eyebrow, the real-theme moment.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Interfaces from texels.' })
    ).toBeVisible();
    await expect(page.getByText('One catalog · web and native')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /themes, one engine/ })).toBeVisible();
    await expect(page.locator('[data-tx-hero-theme]')).toHaveCount(6);

    // The hero CTA pair and the gallery links behind the moment.
    const hero = page.locator('[data-tx-web-hero]');
    const start = hero.getByRole('link', { name: 'Start building' });
    await expect(start).toBeVisible();
    await start.focus();
    await expect(start).toBeFocused();
    const native = hero.getByRole('link', { name: 'See the native story' });
    await expect(native).toBeVisible();
    await native.focus();
    await expect(native).toBeFocused();
    await expect(hero.getByRole('link', { name: 'Browse the theme gallery' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Browse the component catalog' })).toBeVisible();

    // Why Svelte for the web: the ladder rungs render under the section h2.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Why Svelte for the web' })
    ).toBeVisible();
    await expect(page.locator('[data-tx-ladder-layer]').first()).toBeVisible();

    // The correlation demo: three panels of the badge walk, the shared
    // summary string visible in the projections.
    await expect(
      page.getByRole('heading', { level: 2, name: 'One line in, two languages out' })
    ).toBeVisible();
    await expect(page.locator('[data-tx-corr-panel]')).toHaveCount(3);
    await expect(page.getByText('A compact status or category label.').first()).toBeVisible();

    // Agents + closing CTA: the install copy works from the keyboard.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Built for agents, too' })
    ).toBeVisible();
    const agents = page.locator('[data-tx-web-agents]');
    const copy = agents.getByRole('button', { name: 'Copy install command' });
    await copy.scrollIntoViewIfNeeded();
    await copy.focus();
    await expect(copy).toBeFocused();
    const status = agents.locator('[data-copy-command-status]');
    await expect(status).toHaveText('');
    await copy.click();
    await expect(status).toHaveText(/copy/i);

    await expect(page.getByText('One platform, two runtimes. Start today.')).toBeVisible();

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'llms.txt' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Agent skill' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Changelog' })).toBeVisible();
    await expect(footer.getByText(/Dailybot, Inc/)).toBeVisible();
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
