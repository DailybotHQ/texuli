import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const nav = (page: import('@playwright/test').Page) =>
  page.locator('[aria-label="Search result pages"]');

scenario(
  'pagination',
  defineRows([
    {
      id: 'landmark-and-current-page',
      title: 'pagination is a named navigation landmark with one current page',
      async run({ page }) {
        await expect(nav(page)).toBeVisible();
        await expect(nav(page)).toHaveRole('navigation');
        await expect(nav(page).getByRole('button', { name: 'Page 5' })).toHaveAttribute(
          'aria-current',
          'page'
        );
        await expect(nav(page).getByRole('button').first()).toBeEnabled();
        await expect(nav(page).getByRole('button').last()).toBeEnabled();
      },
    },
    {
      id: 'pointer-selects-page',
      title: 'pointer activation selects a page and updates the current-page state',
      async run({ page }) {
        await nav(page).getByRole('button', { name: 'Page 6' }).click();
        await expect(nav(page).getByRole('button', { name: 'Page 6' })).toHaveAttribute(
          'aria-current',
          'page'
        );
      },
    },
    {
      id: 'keyboard-activates-page',
      title: 'Enter and Space select the focused page button',
      async run({ page }) {
        const pageSix = nav(page).getByRole('button', { name: 'Page 6' });
        await pageSix.focus();
        await page.keyboard.press('Enter');
        await expect(pageSix).toHaveAttribute('aria-current', 'page');

        const pageSeven = nav(page).getByRole('button', { name: 'Page 7' });
        await pageSeven.focus();
        await page.keyboard.press('Space');
        await expect(pageSeven).toHaveAttribute('aria-current', 'page');
      },
    },
    {
      id: 'touch-activates-next',
      title: 'touch activation advances to the next page',
      async run({ page }) {
        const next = nav(page).getByRole('button', { name: 'Next' });
        if ((page.viewportSize()?.width ?? 0) < 600) await next.tap();
        else await next.click();
        await expect(nav(page).getByRole('button', { name: 'Page 6' })).toHaveAttribute(
          'aria-current',
          'page'
        );
      },
    },
    {
      id: 'axe-clean',
      title: 'the pagination landmark and controls have no axe violations',
      async run({ page }) {
        const results = await new AxeBuilder({ page })
          .include('[aria-label="Search result pages"]')
          .analyze();
        expect(results.violations).toEqual([]);
      },
    },
  ])
);
