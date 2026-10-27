/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com agents page: catalog, tiers, renderer, MCP, CLI, golden set,
 * links to llms.txt and catalog JSON. Built static site — run `pnpm build` first.
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec.');
  }
  if (!existsSync(join(DIST, 'agents-page', 'index.html'))) {
    throw new Error('Agents page missing from dist — rebuild the website.');
  }
  if (!existsSync(join(DIST, 'llms', 'llms.txt'))) {
    throw new Error('public/llms/llms.txt missing from dist.');
  }
  if (!existsSync(join(DIST, 'catalog', 'catalog.json'))) {
    throw new Error('public/catalog/catalog.json missing from dist.');
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

async function visit(page: Page, path: string) {
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

test.describe('texuli.com agents page', () => {
  test('page covers agent topics and marks nav', async ({ page }) => {
    expect(await visit(page, '/agents-page/')).toEqual([]);
    await expect(page).toHaveTitle('For agents · Texuli');
    await expect(page.getByRole('heading', { level: 1, name: 'Texuli for agents' })).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Agents', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://texuli.com/agents-page/'
    );

    for (const title of [
      'Closed catalog',
      'Emit tiers',
      'Sink-free renderer',
      'MCP server',
      'CLI',
      'Golden set',
    ]) {
      await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
    }

    await expect(page.getByRole('heading', { level: 2, name: 'Setup order' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Agent resources' })).toBeVisible();
  });

  test('llms.txt and catalog JSON are same-origin static files', async ({ page }) => {
    expect(await visit(page, '/agents-page/')).toEqual([]);
    const llms = page.getByRole('link', { name: /llms\.txt/i }).first();
    await expect(llms).toHaveAttribute('href', /\/llms\/llms\.txt$/);
    const catalog = page.getByRole('link', { name: /Catalog JSON/i }).first();
    await expect(catalog).toHaveAttribute('href', /\/catalog\/catalog\.json$/);

    expect(await visit(page, '/llms/llms.txt')).toEqual([]);
    const llmsBody = await page.locator('body').innerText();
    expect(llmsBody).toMatch(/Texuli/i);
    expect(llmsBody.length).toBeGreaterThan(40);

    expect(await visit(page, '/catalog/catalog.json')).toEqual([]);
    const jsonText = await page.locator('body').innerText();
    const parsed = JSON.parse(jsonText) as { format?: string; entries?: unknown[] };
    expect(parsed.format).toBe('texuli-catalog');
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect((parsed.entries ?? []).length).toBeGreaterThan(10);
  });

  test('is static: no foreign network on agents page', async ({ page }) => {
    expect(await visit(page, '/agents-page/')).toEqual([]);
  });

  // axe on this page in light and dark (zero exclusions) runs in the page sweep,
  // a11y-site.spec.ts.
});
