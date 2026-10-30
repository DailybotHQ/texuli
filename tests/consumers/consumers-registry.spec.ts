/// <reference types="node" />
/**
 * Consumers matrix, registry mode (T-p10-consumers-matrix): the same six
 * consumer fixtures install the *published* tarballs of the workspace
 * version (`0.9.0` after the release/0.9.0 merge) from
 * the npm registry — not local `file:` packs — and must build, typecheck
 * and render the same smoke surface. This failed before the 2026-10-25
 * publish: the registry had no such version to install.
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  assertInstalledFromRegistry,
  buildConsumer,
  CONSUMERS,
  REPO_ROOT,
  run,
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
    let file = join(distRoot, path === '/' ? 'index.html' : path.slice(1));
    if (!file.startsWith(distRoot)) file = join(distRoot, '404');
    if (existsSync(file) && file.endsWith('/')) file = join(file, 'index.html');
    if (!existsSync(file)) {
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
      resolvePromise({
        server,
        origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      });
    });
  });
}

/**
 * The version under test: the workspace manifest version, which must be
 * published on the registry. Before the publish this read 404 and the
 * whole suite failed.
 */
async function publishedVersion(): Promise<string> {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, 'packages/core/package.json'), 'utf8')
  ) as { version: string };
  const onRegistry = await run(
    'npm',
    ['view', `@texuli/core@${manifest.version}`, 'version'],
    REPO_ROOT
  );
  if (!onRegistry.includes(manifest.version)) {
    throw new Error(
      `@texuli/core@${manifest.version} is not on the npm registry; run the publish workflow first`
    );
  }
  return manifest.version;
}

let version: string;
// buildConsumer's signature takes a tarball map; registry mode never reads
// it, so nothing is packed for this spec.
const tarballs: TarballMap = { dir: '', byName: {}, nameByDir: {} };

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(600_000);
  version = await publishedVersion();
});

for (const consumer of CONSUMERS) {
  test.describe(consumer.id, () => {
    test(`installs the published tarballs from the registry, builds, and renders the smoke surface (${consumer.framework}${consumer.tailwind ? ' + tailwind' : ''})`, async ({
      page,
    }) => {
      test.setTimeout(600_000);
      const built = await buildConsumer(consumer, tarballs, {
        source: { kind: 'registry', version },
      });
      assertInstalledFromRegistry(built.dir, TEXULI_INSTALL_NAMES, version);
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
        await expect(page.locator('[data-package="texuli"]')).toBeVisible();
        await expect(page.locator('[data-package="core"]')).toContainText('example.com');
        await expect(page.locator('[data-package="tokens"]')).toBeVisible();
        await expect(page.locator('[data-package="primitives"]')).toBeVisible();
        await expect(page.locator('[data-package="texuli-ui"]')).toBeVisible();
        await expect(page.locator('[data-package="texuli-select"]')).toBeVisible();
        await expect(page.locator('[data-package="data-grid"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Smoke button' })).toBeVisible();
      } finally {
        await new Promise<void>((done) => server.close(() => done()));
      }
    });
  });
}

test('every consumer of the registry matrix resolved the published version', async () => {
  expect(version).toMatch(/^\d+\.\d+\.\d+/);
  expect(CONSUMERS).toHaveLength(6);
});
