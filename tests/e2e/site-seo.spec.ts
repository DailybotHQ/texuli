/// <reference types="node" />
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, relative, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  absoluteUrl,
  buildRobots,
  buildSitemap,
  escapeXml,
  normalizePagePath,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  ogImageFile,
  ogImageSvg,
  readPageMeta,
  wrapText,
} from '../../apps/website/src/components/seo/seo.ts';

/*
 * texuli.com SEO (T-site-seo): head metadata, per-page social images built
 * at compile time, sitemap, robots and the 404. Served from
 * apps/website/dist like a static host (unknown paths get 404.html with a
 * 404 status), with no runtime network.
 */

const DIST = resolve('apps/website/dist');
const SITE = 'https://texuli.com';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
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

/** Every built page as a normalized path (`/`, `/guides/theming/`, …). */
function builtPages(): string[] {
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html')
        pages.push(normalizePagePath(`/${relative(DIST, dir)}`));
    }
  };
  walk(DIST);
  return pages.sort();
}

const NOINDEX = /<meta name="robots" content="noindex"/;

/** Whether a built page asks not to be indexed (the 404, example previews). */
function isNoindex(path: string): boolean {
  return NOINDEX.test(readFileSync(join(DIST, path, 'index.html'), 'utf8'));
}

/** Built pages that should be indexed: in the sitemap, with a social image. */
function indexedPages(): string[] {
  return builtPages().filter((path) => path !== '/404/' && !isNoindex(path));
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number; signature: boolean } {
  const bytes = readFileSync(file);
  return {
    signature: bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

async function visit(page: Page, path: string) {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  const response = await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  return { foreign, status: response?.status() };
}

const meta = (page: Page, key: string, attribute = 'property') =>
  page.locator(`head meta[${attribute}="${key}"]`).getAttribute('content');

test.describe('seo helpers', () => {
  test('normalize paths, files and absolute URLs (with a base path)', () => {
    expect(normalizePagePath('/guides/theming')).toBe('/guides/theming/');
    expect(normalizePagePath('guides/theming/index.html')).toBe('/guides/theming/');
    expect(normalizePagePath('/preview/guides/', '/preview/')).toBe('/guides/');
    expect(normalizePagePath('')).toBe('/');
    expect(ogImageFile('/')).toBe('og/index.png');
    expect(ogImageFile('/component-pages/button/')).toBe('og/component-pages/button.png');
    expect(absoluteUrl(SITE, '/', '/guides/')).toBe('https://texuli.com/guides/');
    expect(absoluteUrl(SITE, '/preview', 'og/index.png')).toBe(
      'https://texuli.com/preview/og/index.png'
    );
  });

  test('escape XML and build the sitemap and robots', () => {
    expect(escapeXml(`a&b<c>"d"'e'${String.fromCharCode(1)}`)).toBe(
      'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;'
    );
    const xml = buildSitemap([`${SITE}/b/`, `${SITE}/`, `${SITE}/b/`, `${SITE}/a?x=1&y=2`]);
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    expect(xml.indexOf(`${SITE}/</loc>`)).toBeLessThan(xml.indexOf(`${SITE}/b/</loc>`));
    expect(xml).toContain('x=1&amp;y=2');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(buildRobots(`${SITE}/sitemap.xml`)).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
    );
  });

  test('read page meta, wrap text and escape hostile titles in the image', () => {
    const html =
      '<html><head><title>Tom &amp; Jerry &#183; Texuli</title><meta name="description" content="A &quot;quoted&quot; page"><meta name="robots" content="noindex"></head><body><title>ignored</title></body></html>';
    expect(readPageMeta(html)).toEqual({
      title: 'Tom & Jerry \u00b7 Texuli',
      description: 'A "quoted" page',
      noindex: true,
    });
    expect(wrapText('one two three four five six', 9, 2)).toEqual(['one two', 'three\u2026']);
    expect(wrapText('short', 20, 3)).toEqual(['short']);
    const svg = ogImageSvg({
      title: '<script>alert(1)</script> & "x"',
      description: '</text><image href="https://evil.example/x.png"/>',
      url: 'texuli.com/x',
      siteName: 'Texuli',
    });
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<image');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain(`width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}"`);
  });
});

test.describe('texuli.com SEO build output', () => {
  test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
    const robots = await request.get(`${origin}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  });

  test('the sitemap lists every indexed page once (not the 404 or noindex previews)', async ({
    request,
  }) => {
    const response = await request.get(`${origin}/sitemap.xml`);
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] as string);
    const expected = indexedPages().map((path) => `${SITE}${path}`);
    expect(new Set(locs).size).toBe(locs.length);
    expect([...locs].sort()).toEqual([...expected].sort());
    expect(locs).toContain(`${SITE}/`);
    expect(locs.some((loc) => loc.includes('/component-pages/'))).toBe(true);
    expect(locs.some((loc) => loc.includes('404'))).toBe(false);
    expect(locs.some((loc) => loc.includes('/examples/preview/'))).toBe(false);
  });

  test('example preview documents are noindex', () => {
    const previews = builtPages().filter((path) => path.startsWith('/examples/preview/'));
    expect(previews.length).toBeGreaterThan(0);
    for (const path of previews) expect(isNoindex(path), path).toBe(true);
  });

  test('every listed page has a 1200x630 PNG social image built at compile time', () => {
    const pages = indexedPages();
    expect(pages.length).toBeGreaterThan(20);
    for (const path of pages) {
      const file = join(DIST, ogImageFile(path));
      expect(existsSync(file), path).toBe(true);
      expect(pngSize(file), path).toEqual({
        signature: true,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      });
    }
  });

  for (const path of ['/', '/guides/theming/', '/component-pages/button/']) {
    test(`head metadata on ${path}`, async ({ page, request }) => {
      const { foreign, status } = await visit(page, path);
      expect(status).toBe(200);
      expect(foreign).toEqual([]);
      const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`${SITE}${path}`);
      expect(await meta(page, 'og:url')).toBe(canonical);
      expect(await meta(page, 'og:type')).toBe('website');
      expect(await meta(page, 'og:site_name')).toBe('Texuli');
      const title = await page.title();
      expect(await meta(page, 'og:title')).toBe(title);
      expect(await meta(page, 'og:description')).toBe(await meta(page, 'description', 'name'));
      const image = await meta(page, 'og:image');
      expect(image).toBe(`${SITE}/${ogImageFile(path)}`);
      expect(await meta(page, 'og:image:width')).toBe(String(OG_IMAGE_WIDTH));
      expect(await meta(page, 'og:image:height')).toBe(String(OG_IMAGE_HEIGHT));
      expect(await meta(page, 'twitter:card', 'name')).toBe('summary_large_image');
      expect(await meta(page, 'twitter:image', 'name')).toBe(image);
      expect(await page.locator('head meta[name="robots"]').count()).toBe(0);
      // The image the tags name is served by the static host.
      const png = await request.get(`${origin}/${ogImageFile(path)}`);
      expect(png.status()).toBe(200);
      expect(png.headers()['content-type']).toBe('image/png');
    });
  }

  test('an unknown path gets the 404 page: noindex, no canonical, links home', async ({ page }) => {
    const { foreign, status } = await visit(page, '/no-such-page/');
    expect(status).toBe(404);
    expect(foreign).toEqual([]);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    expect(await page.locator('head meta[name="robots"]').getAttribute('content')).toBe('noindex');
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(0);
    expect(await page.locator('head meta[property="og:image"]').count()).toBe(0);
    // The requested path is not echoed back into the page.
    expect(await page.locator('main').textContent()).not.toContain('no-such-page');
    const home = page.getByRole('main').getByRole('link', { name: 'Home' });
    await expect(home).toHaveAttribute('href', '/');
    // Keyboard: the skip link comes first (WebKit's default Tab skips links,
    // a macOS setting) and moves focus to main; the links are focusable.
    const skip = page.getByRole('link', { name: 'Skip to content' });
    if (test.info().project.name !== 'webkit') {
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
    } else {
      await skip.focus();
    }
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await home.focus();
    await expect(home).toBeFocused();
  });

  for (const scheme of ['light', 'dark'] as const) {
    for (const path of ['/no-such-page/', '/']) {
      test(`axe is clean on ${path === '/' ? 'the home page' : 'the 404 page'} in ${scheme}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await visit(page, path);
        await expect(page.locator('html')).toHaveAttribute('data-tx-mode', scheme);
        const result = await new AxeBuilder({ page }).analyze();
        expect(
          result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)
        ).toEqual([]);
      });
    }
  }
});
