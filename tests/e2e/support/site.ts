/// <reference types="node" />
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Shared helpers for the specs that sweep the built texuli.com
 * (`apps/website/dist`): a static server, the sitemap paths, axe with zero
 * exclusions, and the polish check a screenshot review would flag.
 */

export const DIST = resolve('apps/website/dist');
const SITE = 'https://texuli.com';

export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];

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
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

/** Site paths from the built sitemap, sorted, plus the 404 (served for an unknown path). */
export function sitePaths(): string[] {
  const sitemap = join(DIST, 'sitemap.xml');
  if (!existsSync(sitemap)) return [];
  const paths = [...readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    (match[1] as string).replace(SITE, '')
  );
  return [...paths.sort(), '/__missing__/'];
}

/**
 * The pages a sweep visits: up to `perGroup` evenly spaced pages (always the
 * first) of each route group. The pages of a group share a template; the
 * large groups (`/examples/…`, `/component-pages/…`) render one component
 * per page, and those components are axe-checked in the fixture app
 * (a11y-*.spec.ts).
 */
export function sweepSample(paths: readonly string[], perGroup = 4): string[] {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const group = path.split('/')[1] ?? '';
    groups.set(group, [...(groups.get(group) ?? []), path]);
  }
  const kept = new Set<string>();
  for (const members of groups.values()) {
    if (members.length <= perGroup) {
      for (const path of members) kept.add(path);
      continue;
    }
    const step = members.length / perGroup;
    for (let index = 0; index < perGroup; index += 1) {
      kept.add(members[Math.floor(index * step)] as string);
    }
  }
  return paths.filter((path) => kept.has(path));
}

/** One representative page per route group (`/`, `/guides/…`, `/component-pages/…`). */
export function representatives(paths: readonly string[]): Set<string> {
  const seen = new Map<string, string>();
  for (const path of paths) {
    const group = path.split('/')[1] ?? '';
    if (!seen.has(group)) seen.set(group, path);
  }
  return new Set(seen.values());
}

/**
 * Serves `apps/website/dist` on a free port for the spec's workers (unknown
 * paths get the built 404 page). Call at the top level of a spec; read the
 * origin from the returned function inside tests.
 */
export function serveDist(): () => string {
  let server: Server | undefined;
  let origin = '';
  test.beforeAll(async () => {
    if (!existsSync(join(DIST, 'index.html')))
      throw new Error('Run `pnpm build` before this spec.');
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
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(response);
    });
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  test.afterAll(
    () =>
      new Promise<void>((done) => {
        if (!server) return done();
        server.close(() => done());
      })
  );
  return () => origin;
}

/**
 * Waits until a page has settled: the readiness signal (`public/tx-ready.js`)
 * on shell pages, `load` on standalone documents, and every `client:idle`
 * island hydrated (the signal does not wait for those).
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (document.documentElement.dataset.txPageReady === 'true' ||
        (!document.querySelector('script[data-tx-ready-script]') &&
          document.readyState === 'complete')) &&
      document.querySelectorAll('astro-island[ssr][client="idle"]').length === 0,
    undefined,
    { polling: 100 }
  );
}

/**
 * Wait until every finite animation has finished (infinite ones, such as
 * spinners, are ignored), so checks like axe's color contrast never measure a
 * part mid-fade. Gives up quietly after `timeout` ms.
 */
export async function settleAnimations(page: Page, timeout = 3000): Promise<void> {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== 'running' ||
              animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY
          ),
      undefined,
      { timeout, polling: 50 }
    )
    .catch(() => undefined);
}

/** axe with zero exclusions (no disabled rules, no excluded selectors), once animations settle. */
export async function axeViolations(page: Page): Promise<string[]> {
  await settleAnimations(page);
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

/** Copy that means a page still shows a stand-in after it has loaded. */
const STAND_IN =
  /\b(Loading (demo|layout|chart|blocks|preview|props)…|coming soon|lorem ipsum|TODO|not wired|Static props preview)\b/i;

/**
 * What a screenshot review would flag on the page as rendered: horizontal
 * page overflow, an element escaping the viewport outside a scroll
 * container, broken images, an illustration fallback without its mosaic,
 * and stand-in copy left after load.
 */
export async function polishProblems(page: Page): Promise<string[]> {
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
      if (!slot.querySelector('.site-illustration__texels > i'))
        problems.push('illustration fallback without its mosaic');
    }
    const match = standIn.exec(document.body.innerText);
    if (match) problems.push(`stand-in copy after load: "${match[0]}"`);
    return problems;
  }, STAND_IN.source);
}

/** The site mode on the document root matches the emulated color scheme. */
export async function expectMode(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-tx-mode', mode);
}
