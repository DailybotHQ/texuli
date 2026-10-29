/// <reference types="node" />
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  budgetFor,
  DEFAULT_BUDGET,
  INTERACTIVE_SELECTOR,
  isOutputIsland,
  ROUTE_BUDGET_OVERRIDES,
  ROUTE_PREFIX_BUDGETS,
} from '../../apps/website/src/components/perf/budgets.ts';

/*
 * texuli.com performance budgets (T-site-perf). Built static site only — run
 * `pnpm build` first. Sizes are deterministic and always checked. LCP is
 * wall-clock, so it is asserted only with TEXULI_PERF=1 (the machine runs many
 * lanes at once).
 */

const DIST = resolve('apps/website/dist');
const PERF = process.env.TEXULI_PERF === '1';
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

/** Routes measured in the browser: every page family, the heavy routes and this page. */
const BROWSER_ROUTES = [
  '/',
  // PLAN_006 T-91: the new landings, static bodies with only the header islands.
  '/native/',
  '/web-and-native/',
  '/brand/',
  '/foundation/',
  '/showcase/',
  '/showcase/dashboard/',
  '/blocks-page/',
  '/gallery-themes/',
  '/theme-switcher/',
  '/color-explorer/',
  '/component-pages/',
  '/gallery-components/',
  '/gallery-components/preview/',
  '/component-pages/button/',
  '/component-pages/charts-pie/',
  '/agents-page/',
  '/guides/',
  '/playground/',
  '/search/',
  '/docs-shell/',
  '/perf/',
  // PLAN_010 T-site-060: nine lazy motion islands; the settings panel is the only one near the top.
  '/motion-page/',
  // PLAN_010 T-site-070: lazy document and live-generation islands; their large modules load after hydration.
  '/documents-page/',
  '/live-generation/',
] as const;

const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;
const gzipKb = (file: string) => kb(gzipSync(readFileSync(file), { level: 9 }).length);

function htmlRoutes(dir = DIST): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'theme-css' || entry.name === 'theme-data' || entry.name === '_astro')
        continue;
      out.push(...htmlRoutes(path));
    } else if (entry.name === 'index.html') {
      out.push(
        `/${relative(DIST, dir).split('\\').join('/')}${dir === DIST ? '' : '/'}`.replace('//', '/')
      );
    }
  }
  return out.sort();
}

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'perf', 'index.html'))) {
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

interface Visit {
  foreign: string[];
  files: Set<string>;
}

async function visit(page: Page, path: string): Promise<Visit> {
  const result: Visit = { foreign: [], files: new Set() };
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) result.foreign.push(request.url());
  });
  page.on('requestfinished', (request) => {
    if (request.url().startsWith(origin)) result.files.add(new URL(request.url()).pathname);
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
  return result;
}

function fileFor(pathname: string): string | null {
  let file = normalize(join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  return existsSync(file) ? file : null;
}

test.describe('texuli.com performance budgets', () => {
  test('every HTML route stays within its document budget', ({ browserName }, info) => {
    test.skip(
      info.project.name !== 'chromium',
      'file sizes are browser-independent; check them once'
    );
    void browserName;
    const routes = htmlRoutes();
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toEqual(
      expect.arrayContaining(['/', '/perf/', ...ROUTE_BUDGET_OVERRIDES.map((o) => o.route)])
    );
    const over: string[] = [];
    for (const route of routes) {
      const file = join(DIST, route, 'index.html');
      const budget = budgetFor(route);
      const raw = kb(statSync(file).size);
      const gz = gzipKb(file);
      if (raw > budget.htmlRawKb) over.push(`${route}: ${raw} KB raw > ${budget.htmlRawKb}`);
      if (gz > budget.htmlGzipKb) over.push(`${route}: ${gz} KB gzip > ${budget.htmlGzipKb}`);
    }
    expect(over).toEqual([]);
  });

  test('a route family budget applies under its prefix, never to the index', ({
    browserName,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'a data check; run it once');
    void browserName;
    for (const family of ROUTE_PREFIX_BUDGETS) {
      const child = budgetFor(`${family.prefix}any-page/`);
      for (const [key, value] of Object.entries(family.budget)) {
        expect(child[key as keyof typeof child], `${family.label} ${key}`).toBe(value);
      }
      // The index itself keeps its exact entry or the default.
      const index = ROUTE_BUDGET_OVERRIDES.find((entry) => entry.route === family.prefix);
      expect(budgetFor(family.prefix)).toEqual({ ...DEFAULT_BUDGET, ...index?.budget });
    }
  });

  test('every theme ships as its own small same-origin file', ({ browserName }, info) => {
    test.skip(
      info.project.name !== 'chromium',
      'file sizes are browser-independent; check them once'
    );
    void browserName;
    const css = readdirSync(join(DIST, 'theme-css'));
    const data = readdirSync(join(DIST, 'theme-data'));
    expect(css.length).toBe(210);
    expect(data.length).toBe(210);
    for (const name of css) expect(gzipKb(join(DIST, 'theme-css', name)), name).toBeLessThan(4);
    for (const name of data) expect(gzipKb(join(DIST, 'theme-data', name)), name).toBeLessThan(16);
    const sample = readFileSync(join(DIST, 'theme-css', 'enterprise-neutral.css'), 'utf8');
    expect(sample).toContain("[data-tx-theme='enterprise-neutral'][data-tx-mode='dark']");
  });

  test('routes stay on-origin, within page weight and JS, with islands only where interactive', async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    const report: string[] = [];
    for (const route of BROWSER_ROUTES) {
      const { foreign, files } = await visit(page, route);
      expect(foreign, route).toEqual([]);
      // The analytics loader is mounted in BaseLayout (T-39) and stays silent in
      // the default build: no tag, no loader file, no proxy request (T-91).
      expect(await page.locator('script[data-umami-loader]').count(), route).toBe(0);
      expect(
        [...files].filter((f) => /umami-loader\.js|\/api\/umami\//.test(f)),
        route
      ).toEqual([]);
      const budget = budgetFor(route);
      let total = 0;
      let js = 0;
      for (const pathname of files) {
        const file = fileFor(pathname);
        if (!file) continue;
        const size = gzipKb(file);
        total += size;
        if (file.endsWith('.js')) js += size;
      }
      total = Math.round(total * 10) / 10;
      js = Math.round(js * 10) / 10;
      report.push(`${route} page=${total}KB js=${js}KB`);
      expect(total, `${route} page weight`).toBeLessThanOrEqual(budget.pageGzipKb);
      expect(js, `${route} JavaScript`).toBeLessThanOrEqual(budget.jsGzipKb);
      // An island is worth its JavaScript only when it holds something to operate.
      const idle = await page.$$eval(
        'astro-island',
        (islands, selector) =>
          islands
            .filter((island) => !island.querySelector(selector))
            .map((island) => island.getAttribute('component-url') ?? 'unknown'),
        INTERACTIVE_SELECTOR
      );
      expect(
        idle.filter((url) => !isOutputIsland(url)),
        `${route} islands without interactive content`
      ).toEqual([]);
    }
    await info.attach('page-weights', { body: report.join('\n'), contentType: 'text/plain' });
  });

  test('layout stays stable during load (CLS), and LCP meets its budget with TEXULI_PERF=1', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'WebKit does not report layout-shift or LCP entries');
    // Seventeen routes in one test: allow for a loaded machine (this is not a timing assertion).
    test.setTimeout(180_000);
    for (const route of BROWSER_ROUTES) {
      await visit(page, route);
      const { cls, lcp } = await page.evaluate(
        () =>
          new Promise<{ cls: number; lcp: number }>((done) => {
            let shift = 0;
            let largest = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as (PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
              })[]) {
                if (!entry.hadRecentInput) shift += entry.value;
              }
            }).observe({ type: 'layout-shift', buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) largest = Math.max(largest, entry.startTime);
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            setTimeout(() => done({ cls: shift, lcp: largest }), 250);
          })
      );
      const budget = budgetFor(route);
      expect(cls, `${route} CLS`).toBeLessThanOrEqual(budget.cls);
      if (PERF) expect(lcp, `${route} LCP`).toBeLessThanOrEqual(budget.lcpMs);
    }
  });

  test('the gallery loads theme CSS only for cards it shows, and pages in more cards', async ({
    page,
  }) => {
    const { files } = await visit(page, '/gallery-themes/');
    const cssFiles = () => [...files].filter((f) => f.startsWith('/theme-css/'));
    await expect(page.locator('[data-theme-id]')).toHaveCount(24);
    await expect.poll(() => cssFiles().length).toBeGreaterThan(0);
    expect(cssFiles().length).toBeLessThanOrEqual(24);
    await expect(page.getByRole('status').first()).toContainText('showing 24 of 210');
    await page.getByRole('button', { name: 'Show 24 more', exact: true }).click();
    await expect(page.locator('[data-theme-id]')).toHaveCount(48);
    // Keyboard users continue from the first new card.
    await expect(page.locator('[data-theme-id]').nth(24).locator('button').first()).toBeFocused();
    await page.getByRole('searchbox', { name: 'Find a theme' }).fill('harbor');
    await expect(page.getByRole('button', { name: /^Show \d+ more$/ })).toHaveCount(0);
  });

  test('applying a theme loads its CSS file first, then applies it site-wide', async ({ page }) => {
    const { files } = await visit(page, '/theme-switcher/');
    const before = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--tx-primary').trim()
    );
    const option = page
      .locator(
        '[data-tx-theme-switcher] button, [data-tx-theme-switcher] [role="radio"], [data-tx-theme-switcher] [role="option"]'
      )
      .filter({ hasText: /Harbor Teal/i })
      .first();
    await option.click();
    await expect(page.locator('html')).toHaveAttribute('data-tx-theme', 'harbor-teal');
    await expect.poll(() => [...files]).toContain('/theme-css/harbor-teal.css');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--tx-primary').trim()
        )
      )
      .not.toBe(before);
  });

  test('the color explorer fetches one theme payload on selection', async ({ page }) => {
    const { files } = await visit(page, '/color-explorer/');
    expect([...files].filter((f) => f.startsWith('/theme-data/'))).toEqual([]);
    await page
      .getByRole('navigation', { name: 'Theme list' })
      .getByRole('button', { name: /Harbor Teal/i })
      .click();
    await expect(page.locator('[data-tx-color-explorer] .status').first()).toContainText(
      'harbor-teal'
    );
    await expect.poll(() => [...files]).toContain('/theme-data/harbor-teal.json');
    await expect.poll(() => [...files]).toContain('/theme-css/harbor-teal.css');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the budgets page passes axe and lists every override (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      expect((await visit(page, '/perf/')).foreign).toEqual([]);
      await expect(page).toHaveTitle('Performance budgets · Texuli');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Performance budgets' })
      ).toBeVisible();
      const table = page.getByRole('table', { name: 'Budgets per route' });
      for (const override of ROUTE_BUDGET_OVERRIDES) {
        // Root route is labeled "Home /" so Playwright name matching is stable.
        const label = override.route === '/' ? 'Home /' : override.route;
        // exact: true — `/component-pages/` must not match `/component-pages/button/`.
        await expect(table.getByRole('rowheader', { name: label, exact: true })).toBeVisible();
      }
      for (const family of ROUTE_PREFIX_BUDGETS) {
        await expect(
          table.getByRole('rowheader', { name: family.label, exact: true })
        ).toBeVisible();
      }
      expect(await page.locator('html').getAttribute('data-tx-mode')).toBe(scheme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
