/// <reference types="node" />
import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * The theme studio URL after it became the Design System Studio (PLAN_011
 * T-ds-studio): /theme-studio/ still serves the studio, links made by the
 * old theme studio (`#theme=` recipes and library themes) still open, and on
 * a phone tabbing through the studio never leaves focus under the sticky
 * header (WCAG 2.4.11). Everything else the studio does is covered by
 * site-ds-studio.spec.ts; axe runs there and in the page sweep.
 */

const origin = serveDist();

async function open(page: Page, hash = '') {
  await page.goto('about:blank');
  await page.goto(`${origin()}/theme-studio/${hash}`);
  await settle(page);
  // The header script publishes a measured pixel height for scroll padding.
  await page.waitForFunction(() =>
    /px$/i.test(
      getComputedStyle(document.documentElement).getPropertyValue('--site-header-height').trim()
    )
  );
}

test('old theme studio links still open, from a recipe and from a library theme', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !/^(blob|data):/.test(url)) foreign.push(url);
  });
  await open(page, '#theme=s=c&seed=%230f766e&c=AA&m=l&r.l.primary=%23115e59');
  const status = page.locator('[data-tx-ds-status]');
  await expect(status).toContainText('Started from a theme studio link', { timeout: 20_000 });
  await open(page, '#theme=s=c&seed=%232b6ce0&c=AA&m=d&lib=devtools-night');
  await expect(status).toContainText('Started from a theme studio link', { timeout: 20_000 });
  await open(page, '#theme=s=i&seed=%232b6ce0&c=AA&m=l');
  await expect(page.locator('[data-tx-ds-refusal]')).toContainText('share-format', {
    timeout: 20_000,
  });
  expect(foreign).toEqual([]);
});

test('on a phone, no tab stop in the studio hides under the sticky header', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 412, height: 839 });
  await open(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const obscured: string[] = [];
  let sampled = 0;
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const studio = document.querySelector('[data-tx-theme-studio]');
      const header = document.querySelector('.site-header');
      const active = document.activeElement as HTMLElement | null;
      if (!studio || !header || !active || !studio.contains(active)) return null;
      const clear = active.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1;
      return {
        clear,
        name:
          active.getAttribute('aria-label') ||
          active.textContent?.trim().slice(0, 40) ||
          active.id ||
          active.tagName,
      };
    });
    if (state === null) {
      if (sampled > 5) break;
      continue;
    }
    sampled += 1;
    if (!state.clear) obscured.push(String(state.name));
  }
  expect(sampled).toBeGreaterThan(5);
  expect(obscured).toEqual([]);
});
