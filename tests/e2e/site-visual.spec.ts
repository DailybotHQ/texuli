/// <reference types="node" />
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/*
 * Visual polish gate for texuli.com (T-site-visual-polish). Every built page,
 * in light and dark, must be free of what a screenshot review flags:
 *  - no horizontal page overflow, and no element escaping the viewport
 *    outside a scroll container (clipped or off-center panels);
 *  - no stand-in copy left after load (loading text, "coming soon", lorem);
 *  - no broken images; illustration slots without artwork paint the texel
 *    mosaic, never an empty box.
 * Plus targeted checks: theme swatches paint the palette of the active mode,
 * inline code keeps its surrounding spaces, demo toolbars fit on a phone.
 *
 * Chromium and the Pixel 7 walk every page; WebKit walks one page per route
 * group. Run `pnpm build` first.
 */

const DIST = resolve('apps/website/dist');
const SITE = 'https://texuli.com';
const MODES = ['light', 'dark'] as const;
type Mode = (typeof MODES)[number];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

/** Copy that means a page still shows a stand-in after it has loaded. */
const STAND_IN =
  /\b(Loading (demo|layout|chart|blocks|preview|props)…|coming soon|lorem ipsum|TODO|not wired|Static props preview)\b/i;

function sitePaths(): string[] {
  const sitemap = join(DIST, 'sitemap.xml');
  if (!existsSync(sitemap)) return [];
  const paths = [...readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    (match[1] as string).replace(SITE, '')
  );
  return [...paths.sort(), '/__missing__/'];
}

function representatives(paths: readonly string[]): Set<string> {
  const seen = new Map<string, string>();
  for (const path of paths) {
    const group = path.split('/')[1] ?? '';
    if (!seen.has(group)) seen.set(group, path);
  }
  return new Set(seen.values());
}

const PATHS = sitePaths();
const SAMPLE = representatives(PATHS);

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

async function open(page: Page, path: string, mode: Mode): Promise<void> {
  await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-tx-mode', mode);
}

/** What a reviewer would flag on the page as rendered. */
async function polishProblems(page: Page): Promise<string[]> {
  return page.evaluate((standInSource) => {
    const standIn = new RegExp(standInSource, 'i');
    const problems: string[] = [];
    const root = document.documentElement;
    const width = root.clientWidth;
    if (root.scrollWidth > width + 1) {
      problems.push(`page overflows horizontally: ${root.scrollWidth}px > ${width}px`);
    }
    const name = (el: Element) => {
      const classes = [...el.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 2);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${classes.length ? `.${classes.join('.')}` : ''}`;
    };
    const inScroller = (el: Element) => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(node).overflowX)) return true;
      }
      return false;
    };
    let escaped = 0;
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed')
        continue;
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      if ((box.right > width + 1 || box.left < -1) && !inScroller(el) && escaped++ < 3) {
        problems.push(
          `${name(el)} escapes the viewport [${Math.round(box.left)}, ${Math.round(box.right)}]`
        );
      }
    }
    for (const img of document.images) {
      const box = img.getBoundingClientRect();
      if (img.complete && img.naturalWidth === 0 && box.width > 2) {
        problems.push(`broken image ${img.getAttribute('src')?.slice(0, 60)}`);
      }
    }
    for (const slot of document.querySelectorAll('[data-tx-illustration-ready="fallback"]')) {
      if (!slot.querySelector('.texel')) problems.push('illustration fallback without its mosaic');
    }
    const match = standIn.exec(document.body.innerText);
    if (match) problems.push(`stand-in copy after load: "${match[0]}"`);
    return problems;
  }, STAND_IN.source);
}

for (const path of PATHS) {
  const name = path === '/__missing__/' ? '404' : path;
  test.describe(`visual ${name}`, () => {
    test.skip(
      ({ browserName }) => browserName === 'webkit' && !SAMPLE.has(path),
      'One page per route group on WebKit'
    );
    for (const mode of MODES) {
      test(`no overflow, clipping or stand-ins (${mode})`, async ({ page }) => {
        // Network idle on a page with preview frames can take a while on a busy machine.
        test.setTimeout(60_000);
        await open(page, path, mode);
        // Lazy demos and previews that are on screen settle before the check.
        await page.waitForTimeout(300);
        expect(await polishProblems(page)).toEqual([]);
      });
    }
  });
}

test.describe('visual polish details', () => {
  test('theme swatches paint the palette of the active mode', async ({ page }) => {
    for (const mode of MODES) {
      await open(page, '/theme-switcher/', mode);
      const swatch = page.locator('[data-swatch-mode]').first();
      await expect(swatch).toHaveAttribute('data-swatch-mode', mode);

      await open(page, '/gallery-themes/', mode);
      await expect(page.locator('[data-theme-id] [data-tx-mode]').first()).toHaveAttribute(
        'data-tx-mode',
        mode
      );
    }
  });

  test('inline code keeps the spaces around it', async ({ page }) => {
    await open(page, '/guides/theming/', 'light');
    const text = await page.locator('main').innerText();
    expect(text).toContain('This site uses enterprise-neutral.');
    expect(text).not.toMatch(/[a-z](enterprise-neutral|tx\.base|texuli init)\b/);
  });

  test('demo frames fit their column on a phone', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'The phone layout');
    await open(page, '/component-pages/button/', 'light');
    const frame = page.locator('[data-tx-demo-frame]').first();
    await expect(frame).toBeVisible();
    const fits = await frame.evaluate((el) => {
      const column = el.closest('.cp__example') ?? el.parentElement;
      return el.getBoundingClientRect().right <= (column?.getBoundingClientRect().right ?? 0) + 1;
    });
    expect(fits).toBe(true);
  });

  test('geo maps and heatmaps paint a color scale, not one flat fill', async ({ page }) => {
    await open(page, '/charts-page/geo/', 'light');
    const fills = await page
      .locator('figure svg rect')
      .evaluateAll((rects) => [...new Set(rects.map((r) => getComputedStyle(r).fill))]);
    expect(fills.length).toBeGreaterThan(3);
    expect(fills).not.toContain('rgb(0, 0, 0)');
  });
});
