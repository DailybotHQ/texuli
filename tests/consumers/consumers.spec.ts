/// <reference types="node" />
/**
 * Consumer apps: Vite, Astro and SvelteKit, with and without Tailwind,
 * install the packed tarball of every packable package and import every
 * exported subpath (tests/consumers/surface.ts derives the list from the
 * source `exports` maps). Each app must install offline from the tarballs,
 * pass the installed-graph, plain Node and type checks (harness.ts), build,
 * render the subpath list in the server pass (SvelteKit, Astro) and after
 * hydration, render one component per UI package with its CSS loaded, and
 * keep every packed stylesheet in its built CSS.
 *
 * Tarballs come from `pnpm verify:packages` (repacked here when missing or
 * older than their sources). Builds are serial to limit load on a busy machine.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import {
  assertBuiltCss,
  assertInstalledFromTarballs,
  type BuiltConsumer,
  buildConsumer,
  CONSUMERS,
  ensureConsumerTarballs,
  REPO_ROOT,
  type TarballMap,
} from './harness.ts';
import { consumerSubpaths, packablePackages, RENDER_CHECKS, uiPackages } from './surface.ts';

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

/** `data-subpath` → `data-exports` of every list item in `html`. */
function listedSubpaths(html: string, list: string): Map<string, number> {
  const start = html.indexOf(list);
  const section = start < 0 ? '' : html.slice(start, html.indexOf('</ul>', start));
  const out = new Map<string, number>();
  for (const match of section.matchAll(/data-subpath="([^"]+)" data-exports="(\d+)"/g)) {
    out.set(match[1] as string, Number(match[2]));
  }
  return out;
}

/** Every module subpath is listed with a runtime export count that matches plain Node's. */
function expectUniverse(
  listed: Map<string, number>,
  modules: readonly string[],
  nodeExports: Record<string, number>,
  where: string
) {
  expect([...listed.keys()].sort(), `${where}: every module subpath`).toEqual([...modules].sort());
  for (const specifier of modules) {
    const count = listed.get(specifier) ?? -1;
    if (specifier in nodeExports) {
      expect(count, `${where}: ${specifier} exports as many names as in plain Node`).toBe(
        nodeExports[specifier]
      );
    } else {
      expect(count, `${where}: ${specifier} has runtime exports`).toBeGreaterThan(0);
    }
  }
}

let tarballs: TarballMap;
// Read once, so a package added to the workspace mid-run cannot skew the checks.
const PACKAGES = packablePackages(REPO_ROOT)
  .map((pkg) => pkg.name)
  .sort();
const SUBPATHS = consumerSubpaths(REPO_ROOT);
const UI_PACKAGES = uiPackages(REPO_ROOT).sort();
const MODULES = SUBPATHS.filter((sub) => sub.kind === 'module').map((sub) => sub.specifier);
const ASTRO = SUBPATHS.filter((sub) => sub.kind === 'astro').map((sub) => sub.specifier);
const NODE = SUBPATHS.filter((sub) => sub.kind === 'node').map((sub) => sub.specifier);

// Serial builds avoid thrashing a loaded machine with parallel npm installs.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(900_000);
  tarballs = await ensureConsumerTarballs();
});

for (const consumer of CONSUMERS) {
  test.describe(consumer.id, () => {
    test(`installs every tarball, imports every subpath, builds and renders (${consumer.framework}${consumer.tailwind ? ' + tailwind' : ''})`, async ({
      page,
    }) => {
      test.setTimeout(900_000);
      const built: BuiltConsumer = await buildConsumer(consumer, tarballs);
      // buildConsumer already asserts tarball installs; re-check for the spec gate.
      assertInstalledFromTarballs(built.dir, tarballs);
      expect(Object.keys(tarballs.byName).sort()).toEqual(PACKAGES);
      const surface = built.surface;
      if (!surface) throw new Error('tarball mode returns the surface results');
      for (const specifier of NODE) {
        expect(surface.nodeExports[specifier], `${specifier} loads in plain Node`).toBeGreaterThan(
          0
        );
      }
      expect(surface.bins.length, 'every bin answers --help').toBeGreaterThan(0);
      expect(surface.types, 'the app was type-checked').toBeDefined();

      let dist = built.dist;
      if (!existsSync(join(dist, 'index.html'))) {
        const alt = join(built.dir, 'build');
        if (existsSync(join(alt, 'index.html'))) dist = alt;
      }
      expect(existsSync(join(dist, 'index.html')), `index.html in ${dist}`).toBe(true);
      const css = assertBuiltCss(built.dir, dist, SUBPATHS);
      expect(css.checked).toBe(SUBPATHS.filter((sub) => sub.kind === 'css').length);

      // The server pass: SvelteKit prerenders, Astro renders the island.
      if (consumer.framework !== 'vite') {
        const html = readFileSync(join(dist, 'index.html'), 'utf8');
        expectUniverse(
          listedSubpaths(html, 'data-tx-consumer-universe'),
          MODULES,
          surface.nodeExports,
          `${consumer.id} server HTML`
        );
        for (const [pkg, check] of Object.entries(RENDER_CHECKS)) {
          if (check.ssr !== null) {
            expect(html.includes(check.ssr), `${consumer.id} server HTML renders ${pkg}`).toBe(
              true
            );
          }
        }
      }

      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const { server, origin } = await serveDist(dist);
      try {
        await page.goto(`${origin}/`);
        await page.waitForSelector('[data-tx-consumer-smoke]', { timeout: 30_000 });
        await expect(page.locator('[data-tx-consumer-universe]')).toHaveAttribute(
          'data-hydrated',
          'true',
          { timeout: 30_000 }
        );
        expectUniverse(
          listedSubpaths(await page.content(), 'data-tx-consumer-universe'),
          MODULES,
          surface.nodeExports,
          `${consumer.id} hydrated page`
        );

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
        }
        await expect(page.locator('[data-package="core"]')).toContainText('example.com');
        await expect(page.locator('[data-package="texuli-select"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Smoke button' })).toBeVisible();

        // One component per UI package, hydrated, with its stylesheet loaded.
        expect(Object.keys(RENDER_CHECKS).sort()).toEqual(UI_PACKAGES);
        const selectors = await page.evaluate(() => {
          const out: string[] = [];
          const walk = (rules: CSSRuleList) => {
            for (const rule of Array.from(rules)) {
              if ('selectorText' in rule) out.push(String(rule.selectorText));
              if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
            }
          };
          for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
          return out.join('\n');
        });
        for (const [pkg, check] of Object.entries(RENDER_CHECKS)) {
          const region = page.locator(check.region);
          await expect(region, `${pkg} region`).toBeVisible();
          await expect
            .poll(() => region.evaluate((el) => el.innerHTML), {
              message: `${pkg} renders "${check.client}"`,
              timeout: 30_000,
            })
            .toContain(check.client);
          if (check.styled) {
            const classes = await region.evaluate((el) =>
              [...new Set([...el.querySelectorAll('[class]')].flatMap((n) => [...n.classList]))]
                .filter((c) => c.startsWith('tx-'))
                .sort()
            );
            const styled = classes.filter((c) =>
              new RegExp(`\\.${c.replace(/[-_]/g, '\\$&')}(?![\\w-])`).test(selectors)
            );
            expect(
              styled.length,
              `${pkg} has a loaded rule for one of ${classes.join(' ')}`
            ).toBeGreaterThan(0);
          }
        }

        if (consumer.framework === 'astro') {
          await page.goto(`${origin}/subpaths/`);
          const listed = listedSubpaths(await page.content(), 'data-tx-consumer-astro-subpaths');
          expect([...listed.keys()].sort()).toEqual([...ASTRO].sort());
          for (const count of listed.values()) expect(count).toBeGreaterThan(0);
        }
        if (consumer.id === 'vite-plain') await expectChartWorker(page, built.dir, dist, origin);
        expect(errors, `${consumer.id}: no uncaught page errors`).toEqual([]);
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
