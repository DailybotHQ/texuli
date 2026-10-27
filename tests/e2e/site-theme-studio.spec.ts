/// <reference types="node" />
import { resolve } from 'node:path';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * Theme studio on texuli.com, in the browser: generate from a color (AA
 * status and CSS export), from mood words and from a local image (no request
 * leaves the origin), switch the export to JSON, and on a phone tabbing
 * through the studio never leaves focus under the sticky header (WCAG
 * 2.4.11). Generation, tuning, exports and share links are unit-tested in
 * apps/website/tests/studios.test.ts and scripts/tests/site-loaders.test.ts;
 * axe runs in the page sweep.
 */

const origin = serveDist();
const FIXTURE_IMAGE = resolve('tests/fixtures/theme-studio-seed.png');

async function open(page: Page) {
  await page.goto(`${origin()}/theme-studio/`);
  await settle(page);
  // The header script publishes a measured pixel height for scroll padding.
  await page.waitForFunction(() =>
    /px$/i.test(
      getComputedStyle(document.documentElement).getPropertyValue('--site-header-height').trim()
    )
  );
}

/** Center the target below the sticky header, then click it. */
async function tap(locator: Locator) {
  await locator.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

test('generates from color, words and a local image, exports JSON, and keeps focus clear of the header', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !/^(blob|data):/.test(url)) foreign.push(url);
  });
  await open(page);
  const status = page.locator('[data-tx-studio-status]');
  const exported = page.locator('[data-tx-studio-export]');
  const source = page.getByRole('group', { name: 'Theme source' });

  await page.getByLabel('Brand color').fill('#0f766e');
  await tap(page.getByRole('button', { name: 'Generate theme' }));
  await expect(status).toContainText(/Theme ready|pairs|AA/i, { timeout: 15_000 });
  await expect(page.locator('[data-tx-studio-aa]')).toBeVisible();
  await expect(exported).toContainText('--tx-primary');

  await tap(source.getByRole('button', { name: 'Words' }));
  await page.getByLabel('Mood words').fill('calm ocean');
  await tap(page.getByRole('button', { name: 'Generate theme' }));
  await expect(status).toContainText(/Theme ready|pairs|AA/i, { timeout: 15_000 });
  await expect(page.locator('[data-tx-studio-error]')).toHaveCount(0);

  await tap(source.getByRole('button', { name: 'Image' }));
  await page.locator('[data-tx-studio-image]').setInputFiles(FIXTURE_IMAGE);
  await expect(page.locator('[data-tx-studio-image-note]')).toBeVisible({ timeout: 15_000 });
  await expect(status).toContainText(/Theme from image|pairs|AA/i, { timeout: 15_000 });
  await expect(exported).toContainText('--tx-primary');

  await tap(
    page.getByRole('group', { name: 'Export format' }).getByRole('button', { name: 'JSON' })
  );
  await expect(exported).toContainText('"id"', { timeout: 10_000 });
  await expect(exported).toContainText('theme-studio');

  // A phone: no tab stop in the studio hides under the sticky header.
  await page.setViewportSize({ width: 412, height: 839 });
  await open(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const obscured: string[] = [];
  let sampled = 0;
  for (let index = 0; index < 40; index += 1) {
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
  expect(foreign).toEqual([]);
});
