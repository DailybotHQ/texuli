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

test.describe('texuli.com landing', () => {
  test('the four sections mount in blueprint order and the CTAs work', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    // T-79 row 2: the title spends the SERP surface on the platform claim.
    await expect(page).toHaveTitle('One component catalog for web and native · Texuli');

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

    // T-79 row 6: the proof strip — real counts, each a link to its list.
    const proof = hero.getByRole('list', { name: 'Texuli by the numbers' });
    await expect(proof.getByRole('listitem')).toHaveCount(3);
    for (const [id, href] of [
      ['components', '/component-pages/'],
      ['primitives', '/primitives-page/'],
      ['examples', '/examples/'],
    ] as const) {
      const stat = proof.locator(`[data-tx-hero-proof="${id}"] a`);
      await expect(stat).toHaveAttribute('href', href);
      await expect(stat).toHaveText(/^\s*\d+\s/);
    }

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
    // Either outcome is announced: "Command copied." (clipboard allowed, e.g.
    // WebKit) or "Copy failed: …" (clipboard denied, e.g. headless Chromium).
    await expect(status).toHaveText(/^(Command copied\.|Copy failed: )/);

    await expect(page.getByText('One platform, two runtimes. Start today.')).toBeVisible();

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'llms.txt' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Agent skill' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Changelog' })).toBeVisible();
    await expect(footer.getByText(/Dailybot, Inc/)).toBeVisible();
    // T-79 rows 3, 4, 9: the release truth and the project row.
    const release = footer.locator('[data-tx-site-status]');
    await expect(release).toContainText('Pre-1.0 packages are on npm');
    await expect(release).toContainText('no stable release yet');
    await expect(release).not.toContainText('not released yet');
    await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/DailybotHQ/texuli'
    );
    await expect(footer.getByRole('link', { name: 'MIT license' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Brand' })).toHaveAttribute('href', '/brand/');
  });

  test('the scroll reveal is opt-in motion: none under reduced motion, never the hero', async ({
    page,
  }) => {
    // T-79 row 13. Reduced motion: no band animates at all.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await visit(page, '/')).toEqual([]);
    const animated = () =>
      page.$$eval('[data-tx-landing] > section', (sections) =>
        sections.map((section) => section.getAnimations().length)
      );
    expect(await animated()).toEqual([0, 0, 0, 0]);
    // Motion allowed: the bands after the hero rise in; the hero never moves.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const counts = await animated();
    expect(counts[0]).toBe(0);
    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
    if (supported) expect(counts.slice(1).every((count) => count > 0)).toBe(true);
  });

  test('changelog page is reachable', async ({ page }) => {
    expect(await visit(page, '/changelog/')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
  });

  // axe on / in light and dark (zero exclusions, the same tags) runs in the page
  // sweep, a11y-site.spec.ts.
});
