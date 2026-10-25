/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  addCommand,
  importedTexuliIds,
  PAGE_BLOCKS,
} from '../../apps/website/src/components/blocks-page/blocks.ts';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com blocks and templates (apps/website/src/pages/blocks-page).
 * Built static site only — run `pnpm build` first. Every block shows a live
 * preview, the `texuli add` command for the components its source imports
 * (run here against the real CLI) and its exact source. No foreign network;
 * axe in light and dark.
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

const PATHS = ['/blocks-page/', ...PAGE_BLOCKS.map((block) => `/blocks-page/${block.id}/`)];
const SECTIONS = resolve('apps/website/src/components/blocks-page/sections');
const sourceOf = (file: string) => readFileSync(join(SECTIONS, file), 'utf8');

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'blocks-page', 'index.html'))) {
    throw new Error('Blocks pages missing from dist — run `pnpm build` first.');
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

test.describe('texuli.com blocks and templates', () => {
  test('the install command of each block lists exactly the texuli components its source imports', () => {
    for (const block of PAGE_BLOCKS) {
      expect(importedTexuliIds(sourceOf(block.file)), block.id).toEqual([...block.add].sort());
    }
  });

  test('every install command runs against the real texuli add CLI (dry run)', ({
    browserName,
  }, info) => {
    test.skip(
      info.project.name !== 'chromium',
      'the CLI check is browser-independent; run it once'
    );
    void browserName;
    const cwd = mkdtempSync(join(tmpdir(), 'texuli-blocks-'));
    try {
      for (const block of PAGE_BLOCKS) {
        for (const id of block.add) {
          const output = execFileSync(
            'pnpm',
            [
              'exec',
              'tsx',
              'packages/tools/src/cli-add/cli.ts',
              id,
              '--cwd',
              cwd,
              '--source-root',
              resolve('.'),
              '--dry-run',
              '--json',
            ],
            { encoding: 'utf8', timeout: 120_000 }
          );
          const result = JSON.parse(output.slice(output.indexOf('{')));
          expect(result.ok, `${block.id}: texuli add ${id}`).toBe(true);
        }
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('the index shows every block: preview, install command and exact source', async ({
    page,
  }) => {
    expect(await visit(page, '/blocks-page/')).toEqual([]);
    await expect(page).toHaveTitle('Blocks and templates · Texuli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Blocks and templates' })
    ).toBeVisible();
    const primary = await primaryNav(page);
    await expect(primary.getByRole('link', { name: 'Blocks', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    for (const block of PAGE_BLOCKS) {
      const section = page.locator(`[data-block="${block.id}"]`);
      await expect(section.getByRole('heading', { level: 2, name: block.title })).toBeVisible();
      await expect(
        section.getByRole('region', { name: `${block.title} preview`, exact: true })
      ).toBeVisible();
      const command = addCommand(block);
      if (command) await expect(section.locator('.block__install')).toContainText(command);
      else await expect(section.locator('.block__install')).toContainText('Nothing to add');
      // The source shown is the file that renders, byte for byte.
      const shown = await section
        .locator('.block__source pre, .block__source code')
        .first()
        .textContent();
      expect(shown?.trim(), block.id).toBe(sourceOf(block.file).trim());
    }
  });

  test('copy buttons put the command and the source on the clipboard', async ({
    page,
    context,
  }, info) => {
    test.skip(info.project.name === 'webkit', 'WebKit does not grant clipboard-read to automation');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await visit(page, '/blocks-page/');
    const hero = page.locator('[data-block="hero"]');
    // Copy buttons are islands: wait until they have hydrated.
    await expect(hero.locator('astro-island[ssr]')).toHaveCount(0);
    await hero.getByRole('button', { name: 'Copy the Hero install command' }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('texuli add badge button');
    await hero.locator('summary').click();
    await hero.getByRole('button', { name: 'Copy the Hero source' }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(sourceOf('HeroSection.svelte'));
  });

  test('interactive previews work: the FAQ accordion by keyboard and the sign-in validation', async ({
    page,
  }) => {
    await visit(page, '/blocks-page/');
    const faq = page.locator('[data-block="faq"]');
    // The FAQ preview is an island hydrated when visible: scroll to it and wait for hydration.
    await faq.scrollIntoViewIfNeeded();
    await expect(faq.locator('.block__preview astro-island[ssr]')).toHaveCount(0);
    const question = faq.getByRole('button', { name: 'Can I export the logs?' });
    await question.scrollIntoViewIfNeeded();
    await expect(question).toHaveAttribute('aria-expanded', 'false');
    await question.focus();
    await page.keyboard.press('Enter');
    await expect(question).toHaveAttribute('aria-expanded', 'true');
    await expect(
      faq
        .getByRole('region', { name: 'FAQ preview', exact: true })
        .getByText('Captain and Harbor export any date range')
    ).toBeVisible();

    const auth = page
      .locator('[data-block="auth"]')
      .getByRole('region', { name: 'Sign in preview', exact: true });
    await auth.getByRole('button', { name: 'Sign in', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-block="auth"] .block__preview astro-island[ssr]')).toHaveCount(
      0
    );
    await auth.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(auth.getByText('Enter an email such as ada@harbor.example.')).toBeVisible();
    await expect(auth.getByRole('textbox', { name: /Email/ })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await auth.getByRole('textbox', { name: /Email/ }).fill('ada@harbor.example');
    await auth.getByLabel(/Password/).fill('correct horse');
    await auth.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(auth.getByRole('status')).toHaveText(
      'Demo only: ada@harbor.example would be signed in now.'
    );
    expect(page.url()).toBe(`${origin}/blocks-page/`);
  });

  test('every block has its own template page', async ({ page }) => {
    for (const block of PAGE_BLOCKS) {
      expect(await visit(page, `/blocks-page/${block.id}/`), block.id).toEqual([]);
      await expect(
        page.getByRole('heading', { level: 1, name: `${block.title} template` })
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: `${block.title} preview`, exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link')
      ).toHaveAttribute('href', '/blocks-page/');
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe on every blocks page with the sources open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of PATHS) {
        expect(await visit(page, path), path).toEqual([]);
        expect(await page.locator('html').getAttribute('data-tx-mode')).toBe(scheme);
        await page.evaluate(() => {
          for (const details of document.querySelectorAll('details')) details.open = true;
        });
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${path} ${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
          ),
          path
        ).toEqual([]);
      }
    });
  }
});
