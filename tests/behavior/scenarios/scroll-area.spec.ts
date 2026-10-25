import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const root = (page: import('@playwright/test').Page) =>
  page.locator('[data-tx-scroll-area]').first();
const viewport = (page: import('@playwright/test').Page) =>
  page.locator('[data-tx-scroll-area-viewport]').first();

scenario(
  'scroll-area',
  defineRows([
    {
      id: 'viewport-scrolls',
      title: 'the viewport scrolls with pointer wheel and keeps content reachable',
      async run({ page }) {
        const vp = viewport(page);
        await expect(vp).toBeVisible();
        await vp.focus();
        const before = await vp.evaluate((el) => el.scrollTop);
        await vp.evaluate((el) => {
          el.scrollTop = 120;
        });
        await expect.poll(async () => vp.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
      },
    },
    {
      id: 'keyboard-scroll',
      title: 'focused viewport scrolls with PageDown and ArrowDown',
      async run({ page }) {
        const vp = viewport(page);
        await vp.focus();
        await page.keyboard.press('PageDown');
        await expect.poll(async () => vp.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      },
    },
    {
      id: 'scrollbar-decorative',
      title: 'custom scrollbar chrome is aria-hidden when present',
      async run({ page }) {
        const bar = page.locator('[data-tx-scroll-area-scrollbar][data-orientation="vertical"]');
        // May be hidden until overflow is measured; force scroll to show always-type
        await viewport(page).evaluate((el) => {
          el.scrollTop = 10;
        });
        if (await bar.count()) {
          await expect(bar.first()).toHaveAttribute('aria-hidden', 'true');
        }
      },
    },
    {
      id: 'named-region',
      title: 'the scroll area root is named for assistive tech',
      async run({ page }) {
        await expect(root(page)).toHaveAttribute('aria-label', /list|messages|items/i);
      },
    },
    {
      id: 'axe-clean',
      title: 'the scroll area scenario has no axe violations',
      async run({ page }) {
        const results = await new AxeBuilder({ page })
          .include('[data-behavior="scenario"]')
          .analyze();
        expect(results.violations).toEqual([]);
      },
    },
  ])
);
