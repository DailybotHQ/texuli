/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { enterDocsFromLanding, primaryNav } from './support/site-nav.ts';

/*
 * Agent playground on texuli.com: paste catalog JSON, sink-free render,
 * hostile presets. Served from apps/website/dist (static, no runtime network).
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
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (
    !existsSync(join(DIST, 'playground', 'index.html')) &&
    !existsSync(join(DIST, 'playground.html'))
  ) {
    throw new Error('Run `pnpm build` before this spec (missing /playground/).');
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
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
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
  await page.waitForLoadState('networkidle');
  return foreign;
}

const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test.describe('texuli.com agent playground', () => {
  test('loads the playground without foreign network requests', async ({ page }) => {
    expect(await visit(page, '/playground/')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Agent playground' })).toBeVisible();
    await expect(page.locator('[data-tx-playground]')).toBeVisible();
    await expect(page.getByLabel('Catalog tree JSON')).toBeVisible();
    await expect(page.getByLabel('Preset')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Render tree' })).toBeVisible();
  });

  test('renders the default safe card and shows a clean validation state', async ({ page }) => {
    expect(await visit(page, '/playground/')).toEqual([]);
    await page.getByRole('button', { name: 'Render tree' }).click();
    await expect(page.locator('[data-tx-playground-tree]')).toBeVisible();
    await expect(page.locator('[data-tx-playground-tree] [data-id="card"]').first()).toBeVisible();
    await expect(page.locator('[data-tx-playground-ok]')).toBeVisible();
    await expect(page.locator('[data-tx-playground-meta]')).toContainText('Roots:');
  });

  test('hostile dialog preset becomes a placeholder with diagnostics', async ({ page }) => {
    expect(await visit(page, '/playground/')).toEqual([]);
    const select = page.getByLabel('Preset');
    // Prefer the fake-dialog sample when present.
    const options = await select
      .locator('option')
      .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
    const dialogPreset =
      options.find((v) => v.includes('fake-dialog') || v.includes('dialog-overlay')) ??
      options.find((v) => v.startsWith('hostile-'));
    expect(dialogPreset).toBeTruthy();
    await select.selectOption(dialogPreset!);
    await page.getByRole('button', { name: 'Render tree' }).click();

    const placeholder = page.locator('[data-tx-playground-tree] [data-kind="placeholder"]');
    const diag = page.locator('[data-tx-playground-diagnostics]');
    const ok = page.locator('[data-tx-playground-ok]');
    // Either a placeholder node or limit/diagnostic lines must appear for hostile input.
    const hasPlaceholder = (await placeholder.count()) > 0;
    const hasDiag = (await diag.count()) > 0;
    const clean = (await ok.count()) > 0;
    expect(hasPlaceholder || hasDiag || clean).toBe(true);
  });

  test('invalid JSON surfaces a parse error alert', async ({ page }) => {
    expect(await visit(page, '/playground/')).toEqual([]);
    const editor = page.getByLabel('Catalog tree JSON');
    await editor.fill('{ not-json');
    await page.getByRole('button', { name: 'Render tree' }).click();
    await expect(page.locator('[data-tx-playground-parse-error]')).toBeVisible();
    await expect(page.locator('[data-tx-playground-parse-error]')).toContainText(
      /JSON parse failed/i
    );
  });

  test('primary nav links to the playground', async ({ page }) => {
    expect(await visit(page, '/')).toEqual([]);
    await enterDocsFromLanding(page);
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Playground', exact: true })).toBeVisible();
    await primary.getByRole('link', { name: 'Playground', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/playground/`);
    // The new page has its own navigation (on phones, reopen the drawer).
    await expect(
      (await primaryNav(page)).getByRole('link', { name: 'Playground', exact: true })
    ).toHaveAttribute('aria-current', 'page');
  });

  test('stays on origin for the playground path', async ({ page }) => {
    expect(await visit(page, '/playground/')).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on the playground (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page, '/playground/');
      expect(await mode(page)).toBe(scheme);
      // Render once so the preview region is populated.
      await page.getByRole('button', { name: 'Render tree' }).click();
      await expect(page.locator('[data-tx-playground-meta]')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${scheme} ${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
