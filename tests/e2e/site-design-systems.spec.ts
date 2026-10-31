/// <reference types="node" />
/**
 * texuli.com /design-systems/ (PLAN_011 T-site-0100), on the built site
 * served with its own per-route `_headers` CSP:
 *
 * - the three example brands (examples/design-systems/) paint the same four
 *   surfaces (dashboard, deck slide, document page, email) side by side,
 *   each scope carrying its brand's compiled variables, with distinct
 *   computed brand colors and the brand's component defaults;
 * - the conformance table prints what the compiler reports: this spec runs
 *   `checkDesignSystem` (the static half of `texuli ds check`) itself and
 *   compares every cell;
 * - every on-site link resolves and every repository link names a file
 *   that exists;
 * - axe in light and dark (no exclusions), zero CSP or Trusted Types
 *   violations, no request off the origin, no client island, nothing
 *   overflows at 360 px;
 * - the page's Markdown twin is built, listed and linked.
 *
 * Copy, data and the static guarantees are unit-tested in
 * apps/website/tests/site-design-systems.test.ts.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { parseTwinHeader } from '../../apps/website/src/components/docs/twins.ts';
import { checkDesignSystem } from '../../packages/tools/src/ds-check/index.ts';
import { axeViolations, expectMode, polishProblems } from './support/site.ts';

const DIST = resolve('apps/website/dist');
const BRANDS = ['quillmark', 'ledgerline', 'tumbletown'] as const;
const SURFACES = ['dashboard', 'slide', 'document', 'email'] as const;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** The enforcing CSP of each route, from the build's `_headers`. */
function policies(): Map<string, string> {
  const out = new Map<string, string>();
  let route = '';
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (line.startsWith('/')) route = line.trim();
    else if (line.startsWith('  Content-Security-Policy: ') && route) {
      out.set(route, line.slice('  Content-Security-Policy: '.length));
    }
  }
  return out;
}

let server: Server | undefined;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'design-systems', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec.');
  }
  const csp = policies();
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    const headers: Record<string, string> = {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    };
    const policy = extname(file) === '.html' ? csp.get(path) : undefined;
    if (policy) headers['content-security-policy'] = policy;
    response.writeHead(200, headers).end(readFileSync(file));
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(
  () =>
    new Promise<void>((done) => {
      if (!server) return done();
      server.close(() => done());
    })
);

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'a static page: checked once, in chromium');
});

/** Record CSP and Trusted Types violations and foreign requests from the first script on. */
async function watch(page: Page): Promise<{ foreign: string[]; errors: string[] }> {
  const foreign: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !/^(blob|data):/.test(url)) foreign.push(url);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const list: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = list;
    document.addEventListener('securitypolicyviolation', (event) => {
      list.push(`${event.violatedDirective} ${event.blockedURI} ${event.sample}`.trim());
    });
  });
  return { foreign, errors };
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);

async function open(page: Page): Promise<void> {
  await page.goto(`${origin}/design-systems/`);
  await page.waitForFunction(() => document.documentElement.dataset.txPageReady === 'true');
}

function brandDocument(id: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve('examples/design-systems', `${id}.json`), 'utf8'));
}

test('three brands paint four surfaces side by side, each with its own compiled colors', async ({
  page,
}) => {
  const { foreign, errors } = await watch(page);
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design systems');
  await expect(page.locator('[data-ds-status]')).toContainText('shipped in 0.10.0');
  await expect(page.locator('[data-ds-status]')).toContainText('0.11 line');
  await expect(page.locator('[data-ds-brand]')).toHaveCount(3);
  await expect(page.locator('[data-ds-preview]')).toHaveCount(12);
  // Static: no island hydrates and the stylesheet is a same-origin file.
  await expect(page.locator('[data-ds-hub] astro-island')).toHaveCount(0);

  const compiled = new Map<string, Record<string, string>>();
  for (const id of BRANDS) {
    const report = await checkDesignSystem(brandDocument(id));
    const light = report.runs[0]?.compiled?.vars.light;
    expect(light, id).toBeTruthy();
    compiled.set(id, light as Record<string, string>);
  }

  for (const surface of SURFACES) {
    const primaries = new Set<string>();
    const painted = new Set<string>();
    for (const id of BRANDS) {
      const scope = page.locator(`[data-ds-preview="${id}:${surface}"] [data-tx-ds="${id}"]`);
      await expect(scope).toHaveAttribute('data-tx-mode', 'light');
      await expect(scope).toHaveAttribute('data-tx-scope', id);
      const computed = await scope.evaluate((el) => ({
        primary: getComputedStyle(el).getPropertyValue('--tx-primary').trim(),
        background: getComputedStyle(el).getPropertyValue('--tx-background').trim(),
        paint: getComputedStyle(el).backgroundColor,
      }));
      expect(computed.primary, `${id} ${surface}`).toBe(compiled.get(id)?.['--tx-primary']);
      expect(computed.background, `${id} ${surface}`).toBe(compiled.get(id)?.['--tx-background']);
      primaries.add(computed.primary);
      painted.add(computed.paint);
    }
    expect(primaries.size, `${surface} brand colors`).toBe(3);
    expect(painted.size, `${surface} painted backgrounds`).toBe(3);
  }

  // The slide is painted with each brand's fill.
  const fills = new Set<string>();
  for (const id of BRANDS) {
    fills.add(
      await page
        .locator(`[data-ds-preview="${id}:slide"] [data-ds-brand-fill]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    );
  }
  expect(fills.size).toBe(3);

  // Component defaults travel with the provider: Ledgerline's buttons are small, Tumbletown's large.
  const button = (id: string) =>
    page.locator(`[data-ds-preview="${id}:email"] button`).evaluate((el) => el.className);
  expect(await button('ledgerline')).toMatch(/tx-button--sm/);
  expect(await button('tumbletown')).toMatch(/tx-button--lg/);
  const radius = (id: string) =>
    page
      .locator(`[data-ds-preview="${id}:email"] button`)
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(await radius('tumbletown')).toBeGreaterThan(await radius('ledgerline'));

  expect(await violations(page)).toEqual([]);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test('the conformance table prints what the compiler reports', async ({ page }) => {
  await watch(page);
  await open(page);
  let rows = 0;
  for (const id of BRANDS) {
    const report = await checkDesignSystem(brandDocument(id));
    expect(report.ok, id).toBe(true);
    for (const run of report.runs) {
      rows += 1;
      const row = page.locator(`[data-ds-run="${id}:${run.variant ?? 'base'}"]`);
      for (const mode of ['light', 'dark'] as const) {
        const pairs = run.contrast[mode] ?? [];
        expect(pairs.length, `${id} ${mode}`).toBeGreaterThan(0);
        await expect(row.locator(`[data-ds-cell="${mode}"]`)).toHaveText(
          `${pairs.filter((pair) => pair.pass).length} of ${pairs.length}`
        );
      }
      await expect(row.locator('[data-ds-cell="target"]')).toHaveText(
        `${run.compiled?.accessibility.contrast}, ${run.compiled?.accessibility.targetMin} px targets`
      );
      await expect(row.locator('[data-ds-cell="targets"]')).toHaveText(
        `${run.targets.filter((target) => target.pass).length} of ${run.targets.length}`
      );
      await expect(row.locator('[data-ds-cell="adjustments"]')).toHaveText(
        String(run.adjustments.length)
      );
      await expect(row.locator('[data-ds-cell="result"]')).toHaveText(
        run.ok ? 'Passes' : 'Refused'
      );
    }
  }
  // Ledgerline declares a high-contrast variant, so `texuli ds check` checks it too.
  expect(rows).toBe(4);
  await expect(page.locator('[data-ds-run]')).toHaveCount(rows);
  await expect(
    page.locator('[data-ds-run="ledgerline:high-contrast"] [data-ds-cell="target"]')
  ).toContainText('AAA');
  await expect(
    page.getByText('texuli ds check examples/design-systems/tumbletown.json')
  ).toBeVisible();
});

test('every link resolves; axe light and dark; 360 px fits', async ({ page }) => {
  test.setTimeout(120_000);
  await watch(page);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await open(page);
  const hrefs = await page
    .locator('[data-ds-hub] a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(8);
  for (const href of ['/theme-studio/', '/mcp-server/']) expect(hrefs).toContain(href);
  for (const href of new Set(hrefs)) {
    if (href.startsWith('#')) {
      await expect(page.locator(href), href).toHaveCount(1);
    } else if (href.startsWith('/')) {
      const response = await page.request.get(`${origin}${href}`);
      expect(response.status(), href).toBe(200);
    } else {
      const match = /^https:\/\/github\.com\/DailybotHQ\/texuli\/blob\/main\/(.+)$/.exec(href);
      expect(match, href).not.toBeNull();
      expect(existsSync(resolve(match?.[1] ?? '__missing__')), href).toBe(true);
    }
  }
  const css = await page.request.get(`${origin}/design-systems/brands.css`);
  expect(css.status()).toBe(200);
  for (const id of BRANDS) expect(await css.text()).toContain(`[data-tx-ds="${id}"]{`);

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await expectMode(page, scheme);
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await polishProblems(page)).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test('the Markdown twin is built, listed and linked', async ({ page }) => {
  const twin = join(DIST, 'design-systems.md');
  expect(existsSync(twin)).toBe(true);
  const body = readFileSync(twin, 'utf8');
  const parsed = parseTwinHeader(body);
  expect(parsed.ok ? parsed.header.title : parsed.problems).toBe('Design systems');
  expect(body).toContain('Conformance');
  expect(body).toContain('Quillmark');
  const manifest = JSON.parse(readFileSync(join(DIST, 'md-manifest.json'), 'utf8')) as unknown;
  expect(JSON.stringify(manifest)).toContain('/design-systems.md');
  await open(page);
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    'href',
    /\/design-systems\.md$/
  );
});
