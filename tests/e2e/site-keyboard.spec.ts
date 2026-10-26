/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/*
 * texuli.com keyboard walk (PLAN_006 T-88). a11y-site.spec.ts already checks
 * the first 40 Tab stops of every page (skip link first, visible focus, no
 * body drop); this spec adds what that sweep does not: the skip link moves
 * focus into the main landmark, a whole-page walk on one page per class
 * (Tab to the end, Shift+Tab retraces the same stops), and the tool islands'
 * single-letter shortcuts stay inactive until the focus is inside the tool
 * (WCAG 2.1.4, "active only on focus"). The phone drawer's trap and Escape
 * are in site-docs-nav.spec.ts. Built site only; run `pnpm build` first.
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
  '.webmanifest': 'application/manifest+json',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': TYPES['.html'] });
      createReadStream(join(DIST, '404.html')).pipe(response);
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

// WebKit's default Tab skips links and buttons (a macOS setting); the phone
// project has no physical keyboard walk to make here.
test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'Desktop Chromium keyboard walk'
);

async function open(page: Page, path: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
}

/** A stable label for the focused element, or `body` when focus dropped. */
function activeLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) return 'body';
    const text = (active.getAttribute('aria-label') ?? active.textContent ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''} "${text}"`;
  });
}

/**
 * Tab from the top until the walk is back at its first stop. Focus on `body`
 * is either the real end (Chromium leaves the document past the last stop,
 * and one more Tab wraps to the first one) or a mid-page drop (an element
 * removed or hidden on focus; the next Tab continues from where it was).
 * One more Tab tells them apart: only a real end lands on the first stop.
 */
async function walkTabStops(
  page: Page,
  limit: number
): Promise<{ stops: string[]; drop: string | null }> {
  const stops: string[] = [];
  for (let press = 0; press < limit; press += 1) {
    await page.keyboard.press('Tab');
    const label = await activeLabel(page);
    if (stops.length > 0 && label === stops[0]) break;
    if (label === 'body') {
      if (stops.length === 0) return { stops, drop: 'focus never left body' };
      await page.keyboard.press('Tab');
      const next = await activeLabel(page);
      if (next !== stops[0])
        return {
          stops,
          drop: `focus dropped to body after stop ${stops.length} (${stops.at(-1)}); the next Tab reached ${next}, not the first stop`,
        };
      break;
    }
    stops.push(label);
  }
  return { stops, drop: null };
}

test.describe('keyboard walk: the walk itself', () => {
  test('a focus drop mid-page fails the walk instead of ending it', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="en"><body>
      <a href="#a">one</a> <a href="#b">two</a>
      <button id="vanish" type="button">vanish</button>
      <a href="#c">three</a> <a href="#d">four</a>
      <script>
        document.getElementById('vanish').addEventListener('focus', (event) => event.target.remove());
      </script></body></html>`);
    const walk = await walkTabStops(page, 50);
    expect(walk.drop, `walked: ${walk.stops.join(' | ')}`).toContain('focus dropped to body');
  });

  test('a page without a drop walks to the end and wraps', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="en"><body>
      <a href="#a">one</a> <button type="button">two</button> <a href="#c">three</a>
      </body></html>`);
    const walk = await walkTabStops(page, 50);
    expect(walk.drop).toBeNull();
    expect(walk.stops).toEqual(['a "one"', 'button "two"', 'a "three"']);
  });
});

/** One page per class from the T-88 walk (walks/keyboard.md). */
const PAGE_CLASSES: ReadonlyArray<{ name: string; path: string; limit: number }> = [
  { name: 'landing', path: '/', limit: 200 },
  { name: 'native', path: '/native/', limit: 200 },
  { name: 'architecture', path: '/web-and-native/', limit: 400 },
  { name: 'guide', path: '/guides/getting-started/', limit: 400 },
  { name: 'component page', path: '/component-pages/button/', limit: 400 },
  { name: 'studio', path: '/theme-studio/', limit: 400 },
  { name: 'theme gallery', path: '/gallery-themes/', limit: 600 },
  { name: '404', path: '/__missing__/', limit: 400 },
];

for (const { name, path, limit } of PAGE_CLASSES) {
  test.describe(`keyboard walk: ${name}`, () => {
    test('the skip link moves focus into the main landmark', async ({ page }) => {
      await open(page, path);
      await page.keyboard.press('Tab');
      expect(await activeLabel(page)).toContain('Skip to content');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      const inMain = await page.evaluate(
        () => document.activeElement?.closest('main, #main') !== null
      );
      expect(inMain, `first stop after the skip link: ${await activeLabel(page)}`).toBe(true);
    });

    test('Tab reaches the end without a trap, and Shift+Tab retraces it', async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, path);
      const { stops, drop } = await walkTabStops(page, limit);
      expect(drop, 'focus must not drop to body before the last stop').toBeNull();
      expect(stops[0], 'the walk starts at the skip link').toContain('Skip to content');
      expect(
        stops.length,
        'the walk hit its limit: a trap or an unexpected stop count'
      ).toBeLessThan(limit);
      // From past the end, Shift+Tab lands on the last stop (one extra press
      // when the walk wrapped to the first stop), then retraces the stops
      // before it. No second forward walk: islands that hydrate on scroll make
      // a blind re-walk race the page.
      const last = stops.length - 1;
      let landed = '';
      for (let press = 0; press < 2 && landed !== stops[last]; press += 1) {
        await page.keyboard.press('Shift+Tab');
        landed = await activeLabel(page);
      }
      expect(landed).toBe(stops[last]);
      const back: string[] = [];
      const count = Math.min(8, last);
      for (let press = 0; press < count; press += 1) {
        await page.keyboard.press('Shift+Tab');
        back.push(await activeLabel(page));
      }
      expect(back).toEqual(stops.slice(last - count, last).reverse());
    });
  });
}

/** Tool islands: the page, the island root, and its keyboard-map disclosure. */
const TOOLS: ReadonlyArray<{ path: string; root: string; keys: string }> = [
  { path: '/theme-studio/', root: '[data-tx-theme-studio]', keys: '[data-tx-studio-keys]' },
  { path: '/color-explorer/', root: '[data-tx-color-explorer]', keys: '[data-tx-explorer-keys]' },
  { path: '/playground/', root: '[data-tx-playground]', keys: '[data-tx-playground-keys]' },
];

for (const tool of TOOLS) {
  test.describe(`tool shortcuts (WCAG 2.1.4): ${tool.path}`, () => {
    test('stay inactive with the focus outside the tool, work inside it', async ({ page }) => {
      await open(page, tool.path);
      const keys = page.locator(tool.keys);
      await expect(keys).toHaveCount(1);
      // On the page body (nothing focused) and on the skip link: `?` does nothing.
      await page.keyboard.press('Shift+Slash');
      await expect(keys).not.toHaveAttribute('open', '');
      await page.keyboard.press('Tab');
      expect(await activeLabel(page)).toContain('Skip to content');
      await page.keyboard.press('Shift+Slash');
      await expect(keys).not.toHaveAttribute('open', '');
      // With the focus on a control inside the tool, `?` toggles the key map.
      await keys.locator('summary').focus();
      await page.keyboard.press('Shift+Slash');
      await expect(keys).toHaveAttribute('open', '');
      await page.keyboard.press('Shift+Slash');
      await expect(keys).not.toHaveAttribute('open', '');
    });
  });
}

test('color explorer: `/` focuses the filter without typing a slash into it', async ({ page }) => {
  await open(page, '/color-explorer/');
  await page.locator('[data-tx-explorer-keys] summary').focus();
  await page.keyboard.press('Slash');
  const filter = page.locator('#color-explorer-filter');
  await expect(filter).toBeFocused();
  await expect(filter).toHaveValue('');
  // Inside the filter, letters are text, never shortcuts.
  await page.keyboard.type('dl');
  await expect(filter).toHaveValue('dl');
});
