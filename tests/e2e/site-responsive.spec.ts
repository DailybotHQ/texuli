import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/**
 * Responsive sweep of the built site (PLAN_006 T-89): one page per class at
 * 360 and 768 CSS px keeps the page from scrolling sideways and keeps every
 * element inside the viewport (except inside its own scroll container); the
 * landing and native pages also at 360px right to left. The landing header
 * is walked across its breakpoints, and the standalone links the sweep found
 * under 24px are held to WCAG 2.5.8. The desktop width (1280) is the page
 * sweep's polish check in a11y-site-<n>.spec.ts. Requires `pnpm build` first.
 */

const origin = serveDist();

/** One route per page class. */
const PAGES = [
  '/',
  '/native/',
  '/web-and-native/',
  '/guides/getting-started/',
  '/docs-shell/getting-started/',
  '/foundation/',
  '/component-pages/button/',
  '/builder/',
  '/theme-studio/',
  '/playground/',
  '/color-explorer/',
  '/gallery-components/',
  '/gallery-themes/',
  '/showcase/',
  '/brand/',
  '/skill/',
  '/404.html',
] as const;

async function visit(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin()}${path}`);
  await settle(page);
  await page.evaluate(() => document.fonts.ready);
}

/** Page-level horizontal overflow: the scroll width and every element past an inline edge. */
async function overflow(page: Page): Promise<{ scroll: number; viewport: number; out: string[] }> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const clipped = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent === document.body) return false;
        if (getComputedStyle(parent).overflowX !== 'visible') return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const element of document.querySelectorAll('body *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= viewport + 1 && rect.left >= -1) continue;
      if (getComputedStyle(element).position === 'fixed') continue;
      if (clipped(element)) continue;
      const name = element.tagName.toLowerCase();
      const cls = typeof element.className === 'string' ? element.className.split(/\s+/)[0] : '';
      out.push(
        `${name}${cls ? `.${cls}` : ''} ${Math.round(rect.left)}..${Math.round(rect.right)}`
      );
    }
    return { scroll: document.documentElement.scrollWidth, viewport, out: out.slice(0, 8) };
  });
}

test('every page class fits 360 and 768px, and the landings fit 360px right to left', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems: string[] = [];
  for (const width of [360, 768]) {
    for (const path of PAGES) {
      await visit(page, path, width);
      // Disclosures open: the skill page's checksum list and commands must wrap too.
      await page.evaluate(() => {
        for (const details of document.querySelectorAll<HTMLDetailsElement>('main details'))
          details.open = true;
      });
      const result = await overflow(page);
      if (result.out.length > 0 || result.scroll > result.viewport)
        problems.push(
          `${width}px ${path}: scroll ${result.scroll} > ${result.viewport}; ${result.out.join(', ')}`
        );
    }
  }
  for (const path of ['/', '/native/']) {
    await visit(page, path, 360);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const result = await overflow(page);
    if (result.out.length > 0 || result.scroll > result.viewport)
      problems.push(`360px rtl ${path}: ${result.out.join(', ')}`);
  }
  expect(problems).toEqual([]);
});

/** Standalone links the sweep measured under 24px, each on a page that renders it. */
const TARGETS = [
  ['/', '[data-tx-site-header] .brand'],
  ['/', '.web-hero__grid-links a'],
  ['/', '.web-why__claim-link'],
  ['/guides/getting-started/', '.crumbs__link'],
  ['/gallery-components/', '[data-tx-gallery-card] .title a'],
] as const;

test('the landing header fits across its breakpoints, and flagged links are at least 24px', async ({
  page,
}) => {
  for (const width of [360, 400, 641, 700, 767, 769, 800, 900, 1023, 1025, 1100, 1280]) {
    await visit(page, '/', width);
    const header = await page.evaluate(() => {
      const root = document.querySelector('[data-tx-site-header]');
      const viewport = document.documentElement.clientWidth;
      const past = [...(root?.querySelectorAll('*') ?? [])]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.right > viewport + 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const cls = element.getAttribute('class')?.split(/\s+/)[0] ?? '';
          return `${element.tagName.toLowerCase()}.${cls} ${Math.round(rect.left)}-${Math.round(rect.right)}`;
        });
      const visible = (selector: string) => {
        const element = root?.querySelector(selector);
        return Boolean(element && element.getBoundingClientRect().width > 0);
      };
      const wrapped = [...(root?.querySelectorAll('.docs-link') ?? [])].some(
        (element) => element.getBoundingClientRect().height > 48
      );
      return {
        past,
        wrapped,
        doors: visible('nav.platform-links'),
        repo: visible('[data-repo-door]'),
        start: visible('.get-started'),
      };
    });
    expect(header.past, `${width}px: header elements past the viewport`).toEqual([]);
    expect(header.wrapped, `${width}px: a header link wraps`).toBe(false);
    expect(header.doors, `${width}px: platform doors`).toBe(width > 768);
    expect(header.repo, `${width}px: GitHub door`).toBe(width > 1024);
    expect(header.start, `${width}px: Get started`).toBe(width > 1024);
  }
  for (const width of [360, 1280]) {
    for (const [path, selector] of TARGETS) {
      await visit(page, path, width);
      const sizes = await page.evaluate(
        (query) =>
          [...document.querySelectorAll(query)]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.min(rect.width, rect.height)),
        selector
      );
      expect(sizes.length, `${path} ${selector} renders`).toBeGreaterThan(0);
      expect(Math.min(...sizes), `${width}px ${path} ${selector}`).toBeGreaterThanOrEqual(24);
    }
  }
});
