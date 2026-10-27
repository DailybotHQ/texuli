/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * Responsive sweep of the built site (PLAN_006 T-89, rubric dimension 2):
 * every page class at 360 and 768 CSS px, in light and dark, keeps the
 * page from scrolling sideways and keeps every element inside the viewport
 * (except inside its own scroll container); one test per page class walks
 * both widths. The desktop width (1280) is the page sweep's polish check in
 * a11y-site.spec.ts, on every page. The landing header is also
 * walked across its breakpoints, and the standalone links the sweep found
 * under 24px are held to WCAG 2.5.8. The record is
 * `.dwp/plans/PLAN_006_website_marketing_seo_analytics/analysis_results/walks/responsive.md`.
 *
 * Requires `pnpm build` first.
 */

const DIST = resolve(process.cwd(), 'apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** One route per page class. */
const PAGES = [
  ['landing', '/'],
  ['native', '/native/'],
  ['web-and-native', '/web-and-native/'],
  ['guide', '/guides/getting-started/'],
  ['docs shell', '/docs-shell/getting-started/'],
  ['foundation', '/foundation/'],
  ['component page', '/component-pages/button/'],
  ['builder studio', '/builder/'],
  ['theme studio', '/theme-studio/'],
  ['playground studio', '/playground/'],
  ['color explorer studio', '/color-explorer/'],
  ['component gallery', '/gallery-components/'],
  ['theme gallery', '/gallery-themes/'],
  ['showcase', '/showcase/'],
  ['brand', '/brand/'],
  ['404', '/404.html'],
] as const;
const WIDTHS = [360, 768] as const;
const MODES = ['light', 'dark'] as const;

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
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

async function visit(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  await page.evaluate(() => document.fonts.ready);
}

async function setMode(page: Page, mode: (typeof MODES)[number], dir: 'ltr' | 'rtl' = 'ltr') {
  await page.emulateMedia({ colorScheme: mode });
  await page.evaluate(
    ([next, direction]) => {
      const root = document.documentElement;
      root.dataset.txMode = next;
      root.classList.toggle('dark', next === 'dark');
      root.classList.toggle('light', next === 'light');
      root.style.colorScheme = next;
      root.dir = direction;
    },
    [mode, dir] as const
  );
}

/** Page-level horizontal overflow: the scroll width and every element past an inline edge. */
async function overflow(page: Page): Promise<{ scroll: number; viewport: number; out: string[] }> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const clipped = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent === document.body) return false;
        if (getComputedStyle(parent).overflowX !== 'visible') return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const element of document.querySelectorAll('body *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= viewport + 1 && rect.left >= -1) continue;
      if (getComputedStyle(element).position === 'fixed') continue;
      if (clipped(element)) continue;
      const name = element.tagName.toLowerCase();
      const cls = typeof element.className === 'string' ? element.className.split(/\s+/)[0] : '';
      out.push(
        `${name}${cls ? `.${cls}` : ''} ${Math.round(rect.left)}..${Math.round(rect.right)}`
      );
    }
    return { scroll: document.documentElement.scrollWidth, viewport, out: out.slice(0, 8) };
  });
}

for (const [pageClass, path] of PAGES) {
  test(`${pageClass} (${path}) at ${WIDTHS.join(' and ')}px: no horizontal overflow in light and dark`, async ({
    page,
  }) => {
    for (const width of WIDTHS) {
      await visit(page, path, width);
      for (const mode of MODES) {
        await setMode(page, mode);
        const result = await overflow(page);
        expect(result.out, `${width}px ${mode}: elements past the viewport`).toEqual([]);
        expect(result.scroll, `${width}px ${mode}: page scroll width`).toBeLessThanOrEqual(
          result.viewport
        );
      }
    }
  });
}

test('landing and native at 360px right-to-left: no horizontal overflow', async ({ page }) => {
  for (const path of ['/', '/native/']) {
    await visit(page, path, 360);
    for (const mode of MODES) {
      await setMode(page, mode, 'rtl');
      const result = await overflow(page);
      expect(result.out, `${path} ${mode} rtl`).toEqual([]);
      expect(result.scroll, `${path} ${mode} rtl`).toBeLessThanOrEqual(result.viewport);
    }
  }
});

test('the landing header fits across its breakpoints, doors shown only where they fit', async ({
  page,
}) => {
  for (const width of [360, 400, 641, 700, 767, 769, 800, 900, 1023, 1025, 1100, 1280]) {
    await visit(page, '/', width);
    const header = await page.evaluate(() => {
      const root = document.querySelector('[data-tx-site-header]');
      const viewport = document.documentElement.clientWidth;
      const past = [...(root?.querySelectorAll('*') ?? [])]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.right > viewport + 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const cls = element.getAttribute('class')?.split(/\s+/)[0] ?? '';
          return `${element.tagName.toLowerCase()}.${cls} ${Math.round(rect.left)}-${Math.round(rect.right)}`;
        });
      const visible = (selector: string) => {
        const element = root?.querySelector(selector);
        return Boolean(element && element.getBoundingClientRect().width > 0);
      };
      const wrapped = [...(root?.querySelectorAll('.docs-link') ?? [])].some(
        (element) => element.getBoundingClientRect().height > 48
      );
      return {
        past,
        wrapped,
        doors: visible('nav.platform-links'),
        repo: visible('[data-repo-door]'),
        start: visible('.get-started'),
      };
    });
    expect(header.past, `${width}px: header elements past the viewport`).toEqual([]);
    expect(header.wrapped, `${width}px: a header link wraps`).toBe(false);
    expect(header.doors, `${width}px: platform doors`).toBe(width > 768);
    expect(header.repo, `${width}px: GitHub door`).toBe(width > 1024);
    expect(header.start, `${width}px: Get started`).toBe(width > 1024);
  }
});

/** Standalone links the sweep measured under 24px, each on a page that renders it. */
const TARGETS = [
  ['/', '[data-tx-site-header] .brand'],
  ['/', '.web-hero__grid-links a'],
  ['/', '.web-why__claim-link'],
  ['/guides/getting-started/', '.crumbs__link'],
  ['/gallery-components/', '[data-tx-gallery-card] .title a'],
] as const;

test('standalone links the sweep flagged are at least 24px tall at 360 and 1280', async ({
  page,
}) => {
  for (const width of [360, 1280]) {
    for (const [path, selector] of TARGETS) {
      await visit(page, path, width);
      const sizes = await page.evaluate(
        (query) =>
          [...document.querySelectorAll(query)]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.min(rect.width, rect.height)),
        selector
      );
      expect(sizes.length, `${path} ${selector} renders`).toBeGreaterThan(0);
      expect(Math.min(...sizes), `${width}px ${path} ${selector}`).toBeGreaterThanOrEqual(24);
    }
  }
});
