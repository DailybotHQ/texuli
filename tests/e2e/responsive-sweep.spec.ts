/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * Responsive and right-to-left sweep for the surfaces PLAN_004 added (Task
 * 188): player G20 layouts, controls, action forms and flows, the media
 * animation timeline (fixture page `responsive.html`), and the built
 * `/agent-chat/` and `/builder/` pages. At each declared width, in both
 * directions: no horizontal page scroll and no element past the viewport
 * edge (except inside its own scroll container). In RTL, rows flow from the
 * right. One test walks the player surfaces at every width in both
 * directions; one walks both built pages.
 */

// 360 stands for the small phones (400 was a near duplicate).
const WIDTHS = [360, 768, 1024, 1440] as const;
const DIRECTIONS = ['ltr', 'rtl'] as const;

/** Elements that overflow the viewport and are not clipped by a scrolling or hidden ancestor. */
async function overflowing(page: Page, root: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const width = document.documentElement.clientWidth;
    const clipped = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent === document.body) return false;
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX !== 'visible') return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const element of document.querySelectorAll(`${selector} *`)) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= width + 1 && rect.left >= -1) continue;
      if (clipped(element)) continue;
      const name = element.tagName.toLowerCase();
      const hint =
        element.getAttribute('data-tx-player-node') ??
        element.getAttribute('class')?.split(' ')[0] ??
        '';
      out.push(
        `${name}${hint ? `.${hint}` : ''} [${Math.round(rect.left)}, ${Math.round(rect.right)}]`
      );
      if (out.length >= 10) break;
    }
    return out;
  }, root);
}

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'document scroll width').toBeLessThanOrEqual(client + 1);
}

test.describe('responsive sweep · player and timeline surfaces', () => {
  test(`ltr and rtl at ${WIDTHS.join(', ')}px`, async ({ page }) => {
    test.setTimeout(WIDTHS.length * DIRECTIONS.length * 30_000);
    for (const dir of DIRECTIONS) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`/responsive.html?dir=${dir}`);
        await expect(page.locator('#sweep-status')).toHaveText('Ready');
        for (const section of ['layouts', 'controls', 'actions', 'flow']) {
          const host = page.locator(`[data-sweep="${section}"]`);
          await expect(host.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
          await expect(host.locator('[data-tx-player-skeleton]')).toHaveCount(0, {
            timeout: 15_000,
          });
        }
        await expect(
          page.locator('[data-sweep="timeline"] [data-tx-timeline-track]').first()
        ).toBeVisible({
          timeout: 15_000,
        });
        await noHorizontalScroll(page);
        expect(await overflowing(page, '#sweep'), `${width}px`).toEqual([]);

        // Rows flow along the inline axis: from the right in RTL once they are side by side.
        const cards = page
          .locator('[data-sweep="layouts"]')
          .getByRole('heading', { name: /^(Opened|Solved)$/ });
        const [first, second] = await Promise.all([
          cards.nth(0).boundingBox(),
          cards.nth(1).boundingBox(),
        ]);
        if (first && second && Math.abs(first.y - second.y) < 4) {
          if (dir === 'rtl') expect(first.x).toBeGreaterThan(second.x);
          else expect(first.x).toBeLessThan(second.x);
        }
      }
    }
  });
});

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};
let server: Server;
let origin = '';

test.describe('responsive sweep · built site pages', () => {
  test.beforeAll(async () => {
    if (!existsSync(join(DIST, 'builder', 'index.html'))) {
      throw new Error('Run `pnpm build` before this spec (missing /builder/).');
    }
    server = createServer((request, response) => {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
      let file = normalize(join(DIST, path));
      if (!file.startsWith(DIST)) file = join(DIST, '404');
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) {
        response.writeHead(404).end('Not found');
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

  test(`/agent-chat/ and /builder/ in ltr and rtl at ${WIDTHS.join(', ')}px`, async ({ page }) => {
    test.setTimeout(WIDTHS.length * 60_000);
    for (const route of ['/agent-chat/', '/builder/']) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${origin}${route}`);
        await page.waitForLoadState('networkidle');
        for (const dir of DIRECTIONS) {
          await page.evaluate(
            (direction) => document.documentElement.setAttribute('dir', direction),
            dir
          );
          await noHorizontalScroll(page);
          expect(await overflowing(page, 'main'), `${route} ${dir} at ${width}px`).toEqual([]);
        }
      }
    }
  });
});
