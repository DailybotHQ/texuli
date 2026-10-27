/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/*
 * texuli.com screen-reader text, on the built output (T-100 P2-6). The three
 * T-90 page-layer fixes (docs/quality/sr-transcripts-site.md) are pinned at
 * the source in apps/website/tests/docs-reading.test.ts; this spec checks
 * what a reader actually gets after `astro build` and its HTML compression:
 *
 * 1. /web-and-native/ reads "the guide Why Svelte and Kotlin" with the space,
 *    in the page and in its Markdown twin (compressHTML once dropped it).
 * 2. /web-and-native/ has no "Documentation" navigation (the docs-shell demo
 *    sidebar) and no "Documentation menu" disclosure on phones.
 * 3. On /native/, every status badge is followed by a separator that stays in
 *    the accessibility tree, so the ledger never reads "Shipped All 15…".
 *
 * Served from apps/website/dist like a static host; run `pnpm build` first.
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
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

/** Text with every whitespace run collapsed to one space (a reader's view). */
const collapse = (text: string) => text.replace(/\s+/g, ' ');

test.describe('/web-and-native/ reading text', () => {
  test('the guide link keeps its leading space in the page', async ({ page }) => {
    await page.goto(`${origin}/web-and-native/`);
    const text = collapse((await page.locator('main').textContent()) ?? '');
    expect(text).toContain('the guide Why Svelte and Kotlin');
    expect(text).not.toContain('guideWhy');
    // The accessibility tree reads the same run.
    const snapshot = await page.locator('main').ariaSnapshot();
    expect(snapshot).not.toMatch(/guideWhy/);
  });

  test('the Markdown twin keeps the space before the guide link', async ({ request }) => {
    const response = await request.get(`${origin}/web-and-native.md`);
    expect(response.status()).toBe(200);
    const body = collapse(await response.text());
    expect(body).toMatch(/the guide \[?Why Svelte and Kotlin/);
    expect(body).not.toMatch(/guide\[?Why Svelte/);
  });

  test('no docs-shell demo navigation named "Documentation"', async ({ page }) => {
    await page.goto(`${origin}/web-and-native/`);
    await expect(page.getByRole('navigation', { name: 'Documentation', exact: true })).toHaveCount(
      0
    );
    await expect(page.getByRole('button', { name: 'Documentation menu', exact: true })).toHaveCount(
      0
    );
    // The site's own navigation is still there.
    expect(await page.getByRole('navigation').count()).toBeGreaterThan(0);
  });
});

test.describe('/native/ status ledger', () => {
  test('every status badge is followed by a separator the accessibility tree keeps', async ({
    page,
  }) => {
    await page.goto(`${origin}/native/`);
    const rows = await page.locator('.native-status__row dd').evaluateAll((items) =>
      items.map((dd) => {
        const badge = dd.querySelector('.native-status__badge');
        const next = badge?.nextElementSibling ?? null;
        const style = next ? getComputedStyle(next) : null;
        return {
          badge: (badge?.textContent ?? '').trim(),
          sep: next?.classList.contains('native-status__sep') ? (next.textContent ?? '') : null,
          hidden:
            next === null ||
            next.closest('[aria-hidden="true"]') !== null ||
            style?.display === 'none' ||
            style?.visibility === 'hidden',
          text: (dd.textContent ?? '').replace(/\s+/g, ' ').trim(),
        };
      })
    );
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.badge, 'a badge label').not.toBe('');
      expect(row.sep, `the separator after "${row.badge}"`).toBe(': ');
      expect(row.hidden, `the separator after "${row.badge}" stays readable`).toBe(false);
      expect(row.text.startsWith(`${row.badge}: `), row.text).toBe(true);
    }
    const snapshot = await page.locator('.native-status__ledger').ariaSnapshot();
    // Chromium joins the inline runs with a space ("Shipped : All 15…"); what
    // matters is that a separator splits the status from the detail.
    expect(snapshot).not.toMatch(/Shipped All 15/);
    expect(snapshot).toMatch(/Shipped ?: All 15/);
  });
});
