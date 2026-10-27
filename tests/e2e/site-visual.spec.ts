import { expect, type Page, test } from '@playwright/test';
import { expectMode, serveDist, settle } from './support/site.ts';

/*
 * Visual polish details for texuli.com (T-site-visual-polish). The per-page
 * polish check (no horizontal overflow, no element escaping the viewport, no
 * broken image, no stand-in copy, in light and dark) runs in the page sweep,
 * a11y-site.spec.ts, on the same page loads as axe. These are the targeted
 * checks: gallery previews paint the palette of the active mode, inline code
 * keeps its surrounding spaces as rendered, demo frames fit their column on
 * a phone, and color scales paint more than one fill. Run `pnpm build` first.
 */

const origin = serveDist();

async function open(page: Page, path: string, mode: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
  await page.goto(`${origin()}${path}`);
  await settle(page);
  await expectMode(page, mode);
}

test('active-mode palettes, inline code spacing, phone demo frames and color scales', async ({
  page,
}) => {
  for (const mode of ['light', 'dark'] as const) {
    await open(page, '/gallery-themes/', mode);
    await expect(page.locator('[data-theme-id] [data-tx-mode]').first()).toHaveAttribute(
      'data-tx-mode',
      mode
    );
  }

  await open(page, '/guides/theming/', 'light');
  const text = await page.locator('main').innerText();
  expect(text).toContain('This site uses enterprise-neutral.');
  expect(text).not.toMatch(/[a-z](enterprise-neutral|tx\.base|texuli init)\b/);

  await open(page, '/charts-page/geo/', 'light');
  const fills = await page
    .locator('figure svg rect')
    .evaluateAll((rects) => [...new Set(rects.map((r) => getComputedStyle(r).fill))]);
  expect(fills.length).toBeGreaterThan(3);
  expect(fills).not.toContain('rgb(0, 0, 0)');

  await page.setViewportSize({ width: 412, height: 839 });
  await open(page, '/component-pages/button/', 'light');
  const frame = page.locator('[data-tx-demo-frame]').first();
  await expect(frame).toBeVisible();
  expect(
    await frame.evaluate((el) => {
      const column = el.closest('.cp__example') ?? el.parentElement;
      return el.getBoundingClientRect().right <= (column?.getBoundingClientRect().right ?? 0) + 1;
    })
  ).toBe(true);
});
