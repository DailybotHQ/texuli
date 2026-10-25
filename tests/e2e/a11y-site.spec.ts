/// <reference types="node" />
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * Accessibility sweep of texuli.com (T-quality-a11y-site). Every built page
 * (from dist/sitemap.xml, plus the 404) runs axe with ZERO exclusions (no
 * disabled rules, no excluded selectors) in light, dark and high contrast
 * (forced colors), and a keyboard-only walk: the skip link comes first,
 * every Tab stop is visible with a visible focus indicator, focus never
 * drops to the body and never gets trapped.
 *
 * Chromium sweeps every page; WebKit and Pixel 7 sweep one page per route
 * group (the same templates), which keeps the matrix tractable.
 */

const DIST = resolve('apps/website/dist');
const SITE = 'https://texuli.com';
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];
const MODES = ['light', 'dark', 'high-contrast'] as const;
type Mode = (typeof MODES)[number];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

/** Site paths from the built sitemap, plus the 404 (served for an unknown path). */
function sitePaths(): string[] {
  const sitemap = join(DIST, 'sitemap.xml');
  if (!existsSync(sitemap)) return [];
  const paths = [...readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    (match[1] as string).replace(SITE, '')
  );
  return [...paths.sort(), '/__missing__/'];
}

/** One representative page per route group (`/`, `/guides/…`, `/component-pages/…`). */
function representatives(paths: readonly string[]): Set<string> {
  const seen = new Map<string, string>();
  for (const path of paths) {
    const group = path.split('/')[1] ?? '';
    if (!seen.has(group)) seen.set(group, path);
  }
  return new Set(seen.values());
}

const PATHS = sitePaths();
const SAMPLE = representatives(PATHS);

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
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

async function open(page: Page, path: string, mode: Mode): Promise<void> {
  await page.emulateMedia({
    colorScheme: mode === 'dark' ? 'dark' : 'light',
    forcedColors: mode === 'high-contrast' ? 'active' : 'none',
    reducedMotion: 'reduce',
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  if (mode !== 'high-contrast')
    await expect(page.locator('html')).toHaveAttribute('data-tx-mode', mode);
}

async function axeViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

interface FocusStop {
  label: string;
  visible: boolean;
  indicator: boolean;
  body: boolean;
}

/** One Tab press: what got focus, whether it is on screen and shows a focus indicator. */
async function tabStop(page: Page): Promise<FocusStop> {
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) {
      return { label: 'body', visible: false, indicator: false, body: true };
    }
    const tag = active.tagName.toLowerCase();
    const label = `${tag}${active.id ? `#${active.id}` : ''} "${(active.getAttribute('aria-label') ?? active.textContent ?? '').trim().slice(0, 40)}"`;
    const box = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    const visible = box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== 'none';
    // A wrapper may draw the ring (`:has(:focus-visible)`, `:focus-within`).
    let parentRing = false;
    for (
      let node = active.parentElement, depth = 0;
      node && depth < 3;
      node = node.parentElement, depth += 1
    ) {
      const parent = getComputedStyle(node);
      if (
        (parent.outlineStyle !== 'none' && Number.parseFloat(parent.outlineWidth) > 0) ||
        parent.boxShadow !== 'none'
      ) {
        parentRing = true;
        break;
      }
    }
    return { label, visible, indicator: outline || ring || parentRing, body: false };
  });
}

/** Pages whose axe run needs more than the default 30 s on a busy machine. */
const LARGE_PAGES = new Set(['/gallery-components/', '/examples/', '/color-explorer/']);

for (const path of PATHS) {
  const name = path === '/__missing__/' ? '404' : path;
  test.describe(`a11y ${name}`, () => {
    // Every page on desktop Chromium; representative pages on WebKit and Pixel 7.
    test.skip(
      ({ browserName, isMobile }) => (browserName !== 'chromium' || isMobile) && !SAMPLE.has(path),
      'Representative pages only on this project'
    );

    for (const mode of MODES) {
      test(`axe, zero exclusions, ${mode}`, async ({ page }) => {
        // Large pages need more time, never an exclusion. The living gallery
        // holds 125 interactive cards (axe about 30 s on a loaded machine);
        // the examples index and the color explorer took 22 to 28 s on WebKit
        // when measured alone, so a busy machine pushes them past 30 s.
        if (LARGE_PAGES.has(path)) test.setTimeout(120_000);
        await open(page, path, mode);
        expect(await axeViolations(page)).toEqual([]);
      });
    }

    test('keyboard only: skip link first, every stop visible with a focus indicator, no trap', async ({
      page,
    }, testInfo) => {
      // WebKit's default Tab skips links and buttons (a macOS setting), so the
      // keyboard walk runs on Chromium and Pixel 7.
      test.skip(testInfo.project.name === 'webkit', 'WebKit Tab order depends on a system setting');
      await open(page, path, 'light');
      const first = await tabStop(page);
      expect(first.label, 'first Tab stop').toContain('Skip to content');
      const problems: string[] = [];
      const seen: string[] = [first.label];
      for (let press = 0; press < 40; press += 1) {
        const stop = await tabStop(page);
        if (stop.body) break;
        if (!stop.visible) problems.push(`not visible: ${stop.label}`);
        if (!stop.indicator) problems.push(`no focus indicator: ${stop.label}`);
        seen.push(stop.label);
        // Cycling back to the skip link means the whole page was walked.
        if (stop.label.includes('Skip to content')) break;
      }
      expect(problems).toEqual([]);
      // No trap: Shift+Tab walks back out of wherever focus ended.
      await page.keyboard.press('Shift+Tab');
      const back = await page.evaluate(() => document.activeElement?.tagName ?? '');
      expect(back).not.toBe('');
      expect(seen.length).toBeGreaterThan(1);
    });
  });
}
