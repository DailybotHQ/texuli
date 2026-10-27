/// <reference types="node" />
/**
 * /web-and-native/ — the architecture and correlation page (G8,
 * T-49..T-52, integrated by T-44's sibling integration task). The scaffold's
 * shipped behavior is asserted for real (docs-shell membership, metadata,
 * cross-links), and every section the G8 tasks mounted is asserted against
 * the built site. Reads the built site (`pnpm build` first).
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

const pageHtml = () => readFileSync(join(DIST, 'web-and-native', 'index.html'), 'utf8');

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'web-and-native', 'index.html'))) {
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

/** Load a built page and wait for the site's readiness signal. */
async function visit(page: Page, path: string) {
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
}

test.describe('architecture metadata and shell (shipped by T-31/T-32)', () => {
  test.skip(!existsSync(join(DIST, 'web-and-native', 'index.html')), 'run `pnpm build` first');

  test('the title and description follow the T-17 contract', () => {
    const html = pageHtml();
    expect(html).toContain(
      '<title>Web and native, one contract — Texuli&#39;s architecture · Texuli</title>'
    );
    expect(html).toContain('rel="canonical" href="https://texuli.com/web-and-native/"');
  });

  test('the page lives in the docs shell: docs header, sidebar, menu', () => {
    const html = pageHtml();
    const header = html.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(html).toContain('data-tx-site-sidebar');
    expect(header).toContain('data-variant="docs"');
    expect(header).toContain('data-site-menu');
  });

  test('the cross-link rule holds: native landing and the deep-dive guide linked', () => {
    const html = pageHtml();
    expect(html).toContain('href="/native/"');
    expect(html).toContain('href="/guides/why-svelte-kotlin/"');
  });
});

test.describe('architecture why-both section (T-49 slot, T-52 assembly)', () => {
  test.skip(!existsSync(join(DIST, 'web-and-native', 'index.html')), 'run `pnpm build` first');

  test('the section explains why Svelte for the web and Kotlin for native', () => {
    const html = pageHtml();
    const section = html.match(/<h2 id="why-both">[\s\S]*?(?=<div id="how-layered">)/)?.[0] ?? '';
    expect(section, 'the why-both section renders').not.toBe('');
    // Two-technology framing: each technology is argued on its own merits.
    expect(section).toContain('Svelte 5');
    expect(section).toContain('Kotlin');
    // No framework-vs-framework detour: the page names the non-goal itself.
    expect(section).toContain('not one framework ported onto the other');
    // The phone fit is part of the reasoning, honestly stated.
    expect(section).toContain('phones');
    // Both exits are linked from the section.
    expect(section).toContain('/guides/why-svelte-kotlin/');
    expect(section).toContain('/native/');
  });
});

test.describe('architecture one-contract section (T-50 slot, T-52 assembly)', () => {
  test.skip(!existsSync(join(DIST, 'web-and-native', 'index.html')), 'run `pnpm build` first');

  test('the spec manifest and its TS + Kotlin projections render end to end', () => {
    const html = pageHtml();
    const section =
      html.match(/<h2 id="one-contract">[\s\S]*?(?=<div id="portability">)/)?.[0] ?? '';
    expect(section, 'the one-contract section renders').not.toBe('');
    // The mechanism: one manifest → two projections, as the correlation
    // demo's three panels.
    expect((section.match(/data-tx-corr-panel=/g) ?? []).length).toBe(3);
    // The seam is named with the real generated paths.
    expect(section).toContain('packages/spec/generated/typescript');
    expect(section).toContain('packages/spec/generated/kotlin');
    // Diagram or code present: the demo shows the projections' content, and
    // the layer diagrams flank the contract story.
    expect(section).toContain('A compact status or category label.');
  });

  test('the layer diagrams mount under their slot anchor', () => {
    const html = pageHtml();
    expect(html).toContain('id="how-layered"');
    expect(html).toContain('data-tx-arch-section="layers"');
    expect(html).toContain('data-tx-arch-section="ladder"');
  });
});

test.describe('architecture portability section (T-51)', () => {
  test.skip(!existsSync(join(DIST, 'web-and-native', 'index.html')), 'run `pnpm build` first');

  test('interface portability is defined with a concrete move story', () => {
    const html = pageHtml();
    const section =
      html.match(/<div id="portability">[\s\S]*?(?=<h2 id="what-exists-today">)/)?.[0] ?? '';
    expect(section, 'the portability section renders').not.toBe('');
    // The mechanism walk: three cited excerpt panels from the real files.
    expect(section).toContain('packages/catalog/src/manifests/display/manifests.ts');
    expect(section).toContain('packages/spec/generated/typescript/vocabulary.ts');
    expect(section).toContain('packages/spec/generated/kotlin/com/texuli/spec/Vocabulary.kt');
    expect((section.match(/<figure[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // What moving an interface takes: the walk's steps are on the page.
    expect(section).toContain('Define once');
    expect(section).toContain('Project twice');
    // Honest caveats: the limits list is on screen with its own heading.
    expect(section).toContain('What does not move today');
  });
});

test.describe('architecture status and integration (T-52)', () => {
  test.skip(!existsSync(join(DIST, 'web-and-native', 'index.html')), 'run `pnpm build` first');

  test('the status block is honest and the TechArticle graph ships', () => {
    const html = pageHtml();
    const section =
      html.match(
        /<h2 id="what-exists-today">[\s\S]*?(?=<\/main>|<\/article>|<\/div><\/div><\/div>)/
      )?.[0] ?? '';
    expect(section, 'the status section renders').not.toBe('');
    // Web shipped, native in development — both statements, plain words.
    expect(section).toContain('0.1.0-next.1');
    expect(section).toContain('in development');
    expect(section).toContain('Maven Central');
    // The parity table gives the per-capability evidence.
    expect(section).toContain('data-tx-arch-section="parity"');
    // The TechArticle JSON-LD per the T-17 table.
    const jsonLd = html.match(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/
    )?.[1];
    expect(jsonLd, 'a JSON-LD graph is present').toBeTruthy();
    expect(jsonLd!).toContain('"TechArticle"');
    expect(jsonLd!).toContain('"headline"');
    expect(jsonLd!).toContain('https://texuli.com/web-and-native/');
  });

  test('the TOC covers every section and the platform doors link the route', async ({ page }) => {
    await visit(page, '/web-and-native/');
    for (const id of [
      'why-both',
      'how-layered',
      'one-contract',
      'portability',
      'what-exists-today',
    ]) {
      const link = page.locator(`a[href="#${id}"]`).first();
      await expect(link).toBeAttached();
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    // No docs pager: the route rides the platform doors, not the docs
    // reading order. Both doors checked from the built HTML — the landing
    // header's platform menu and the native hero's cross-link.
    await expect(page.locator('nav.docs-pager')).toHaveCount(0);
    const home = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(home).toContain('href="/web-and-native/"');
    expect(readFileSync(join(DIST, 'native', 'index.html'), 'utf8')).toContain(
      'href="/web-and-native/"'
    );
  });

  // PLAN_006 P2-3: the shell's side TOC shows from 64rem and yields to the
  // layout's PageToc from 80rem, so exactly one "On this page" is exposed.
  test(`exactly one visible "On this page" navigation at 1100 and 1400px`, async ({ page }) => {
    for (const width of [1100, 1400]) {
      await page.setViewportSize({ width, height: 900 });
      await visit(page, '/web-and-native/');
      const tocs = page.getByRole('navigation', { name: 'On this page' });
      await expect(tocs).toHaveCount(1);
      await expect(tocs.first()).toBeVisible();
      await expect(tocs.first().locator('a[href="#why-both"]')).toBeVisible();
    }
  });

  // axe on /web-and-native/ (zero exclusions, light and dark) runs in the page
  // sweep, a11y-site.spec.ts.
});
