/// <reference types="node" />
/**
 * Consumer apps: Vite, Astro and SvelteKit install packed Texuli tarballs,
 * with and without Tailwind, and render the smoke surface.
 *
 * Pack is shared once per worker (beforeAll). Builds are sequential to limit
 * load on a busy machine.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import {
  assertInstalledFromTarballs,
  buildConsumer,
  CONSUMERS,
  ensureConsumerTarballs,
  type TarballMap,
  TEXULI_INSTALL_NAMES,
} from './harness.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveDist(distRoot: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://c').pathname);
    let file = normalize(join(distRoot, path));
    if (!file.startsWith(distRoot)) file = join(distRoot, '404');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      // SvelteKit client may nest under _app; try index.html fallback
      const fallback = join(distRoot, 'index.html');
      if (existsSync(fallback) && path === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        createReadStream(fallback).pipe(response);
        return;
      }
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolvePromise({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * vite-plain also builds worker.html: the packed `@texuli/charts/worker` subpath
 * and its side-effect entry must resolve through the exports map, emit a
 * module-worker chunk that still holds the handler, and answer in a real Worker.
 */
async function expectChartWorker(page: Page, dir: string, dist: string, origin: string) {
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { resolved?: string }>;
  };
  expect(lock.packages?.['node_modules/@texuli/charts']?.resolved ?? '').toMatch(/^file:/);
  const assets = readdirSync(join(dist, 'assets')).filter((file) => file.endsWith('.js'));
  const workerChunk = assets
    .map((file) => readFileSync(join(dist, 'assets', file), 'utf8'))
    .find(
      (code) => code.includes('Unknown chart offload operation') && !code.includes('createElement')
    );
  expect(workerChunk, 'a worker chunk with the offload handler').toBeDefined();
  await page.goto(`${origin}/worker.html`);
  const status = page.locator('#worker-status');
  await expect(status).toHaveText('Done', { timeout: 30_000 });
  await expect(status).toHaveAttribute('data-mode', 'worker');
  await expect(status).toHaveAttribute('data-answers', '2');
  await expect(status).toHaveAttribute('data-same', 'true');
}

let tarballs: TarballMap;

// Serial builds avoid thrashing a loaded machine (14 lanes) with parallel npm installs.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(600_000);
  // Reuse tarballs from `pnpm verify:packages` when present; pack when missing.
  tarballs = await ensureConsumerTarballs();
}, 600_000);

for (const consumer of CONSUMERS) {
  test.describe(consumer.id, () => {
    test(`installs tarballs, builds, and renders package smoke (${consumer.framework}${consumer.tailwind ? ' + tailwind' : ''})`, async ({
      page,
    }) => {
      test.setTimeout(600_000);
      const built = await buildConsumer(consumer, tarballs);
      // buildConsumer already asserts tarball installs; re-check for the spec gate.
      assertInstalledFromTarballs(built.dir, tarballs);
      for (const name of TEXULI_INSTALL_NAMES) {
        expect(
          existsSync(join(built.dir, 'node_modules', ...name.split('/'))),
          `${consumer.id} missing ${name}`
        ).toBe(true);
      }
      // SvelteKit static adapter may put pages at dist/ or build/
      let dist = built.dist;
      if (!existsSync(join(dist, 'index.html'))) {
        const alt = join(built.dir, 'build');
        if (existsSync(join(alt, 'index.html'))) dist = alt;
      }
      expect(existsSync(join(dist, 'index.html')), `index.html in ${dist}`).toBe(true);

      const { server, origin } = await serveDist(dist);
      try {
        await page.goto(`${origin}/`);
        await page.waitForSelector('[data-tx-consumer-smoke]', { timeout: 30_000 });
        if (consumer.id === 'astro-plain') {
          const html = await page.content();
          expect(html).toContain('texuli.astro-consumer.appearance');
          await expect(page.locator('html')).toHaveAttribute('data-tx-theme', 'sky');
          await expect(page.locator('html')).toHaveAttribute('data-tx-mode', 'dark');
          await expect(
            page.getByRole('heading', { level: 1, name: 'Content without a client bundle' })
          ).toBeVisible();
          await expect(page.locator('[data-astro-content]')).toContainText(
            'Rendered by the Texuli Astro section.'
          );
          const tokenStylesheet = [...html.matchAll(/href="([^"]+\.css)"/g)]
            .map((match) => match[1])
            .filter((href): href is string => href !== undefined)
            .map((href) => readFileSync(join(dist, href.replace(/^\//, '')), 'utf8'))
            .find((css) => css.includes('@layer tx.base') && css.includes('--tx-background'));
          expect(tokenStylesheet).toBeDefined();
        }
        await expect(page.locator('[data-package="texuli"]')).toBeVisible();
        await expect(page.locator('[data-package="core"]')).toContainText('example.com');
        await expect(page.locator('[data-package="tokens"]')).toBeVisible();
        await expect(page.locator('[data-package="primitives"]')).toBeVisible();
        await expect(page.locator('[data-package="texuli-ui"]')).toBeVisible();
        await expect(page.locator('[data-package="texuli-select"]')).toBeVisible();
        await expect(page.locator('[data-package="data-grid"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Smoke button' })).toBeVisible();
        if (consumer.id === 'vite-plain') await expectChartWorker(page, built.dir, dist, origin);
      } finally {
        await new Promise<void>((done) => server.close(() => done()));
      }
    });
  });
}

test('consumer matrix covers vite, astro, sveltekit × plain/tailwind', () => {
  expect(CONSUMERS).toHaveLength(6);
  const frameworks = new Set(CONSUMERS.map((c) => c.framework));
  expect(frameworks).toEqual(new Set(['vite', 'astro', 'sveltekit']));
  expect(CONSUMERS.filter((c) => c.tailwind)).toHaveLength(3);
  expect(CONSUMERS.filter((c) => !c.tailwind)).toHaveLength(3);
});
