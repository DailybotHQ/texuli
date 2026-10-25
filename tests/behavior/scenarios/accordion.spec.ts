import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { expectFocus } from './common.ts';

const trigger = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name });

scenario(
  'accordion',
  defineRows([
    {
      id: 'heading-level',
      title: 'each trigger is a button inside a level-3 heading, collapsed',
      async run({ page }) {
        await expect(page.getByRole('heading', { level: 3 })).toHaveText([
          'Shipping',
          'Returns',
          'Warranty',
          'Support',
        ]);
        await expect(page.getByRole('button', { name: 'Shipping', expanded: false })).toBeVisible();
      },
    },
    {
      id: 'click-expands',
      title: 'a click expands an item and shows its content',
      async run({ page }) {
        await trigger(page, 'Shipping').click();
        await expect(page.getByRole('button', { name: 'Shipping', expanded: true })).toBeVisible();
        await expect(page.getByText('Orders ship within two fictional days.')).toBeVisible();
      },
    },
    {
      id: 'single-collapses-others',
      title: 'in single mode, opening one closes the other',
      async run({ page }) {
        await trigger(page, 'Shipping').click();
        await trigger(page, 'Returns').click();
        await expect(page.getByRole('button', { name: 'Shipping', expanded: false })).toBeVisible();
        await expect(page.getByText('Orders ship within two fictional days.')).toBeHidden();
      },
    },
    {
      id: 'keyboard',
      title: 'Enter toggles, and arrow keys move between triggers skipping the disabled one',
      async run({ page }) {
        await trigger(page, 'Returns').focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Returns', expanded: true })).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expectFocus(page, 'button', 'Support');
      },
    },
    {
      id: 'disabled',
      title: 'a disabled item cannot open',
      async run({ page }) {
        await expect(trigger(page, 'Warranty')).toBeDisabled();
      },
    },
  ])
);
