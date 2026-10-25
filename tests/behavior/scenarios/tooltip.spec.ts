import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { expectFocus } from './common.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Save draft' });
const tip = (page: import('@playwright/test').Page) => page.locator('[data-behavior-layer]');

scenario(
  'tooltip',
  defineRows([
    {
      id: 'tooltip-role',
      title: 'the shown tip has the tooltip role',
      async run({ page }) {
        await trigger(page).hover();
        await expect(page.getByRole('tooltip')).toHaveText('Saves without publishing', {
          timeout: 2000,
        });
      },
    },
    {
      id: 'hover-after-delay',
      title: 'hover shows it after the delay, not at once',
      async run({ page }) {
        await trigger(page).hover();
        await page.waitForTimeout(100);
        await expect(tip(page)).toHaveCount(0);
        await expect(tip(page)).toHaveText('Saves without publishing', { timeout: 2000 });
      },
    },
    {
      id: 'focus-shows',
      title: 'focus shows it',
      async run({ page }) {
        await trigger(page).focus();
        await expectFocus(page, 'button', 'Save draft');
        await expect(tip(page)).toHaveText('Saves without publishing', { timeout: 2000 });
      },
    },
    {
      id: 'describes-trigger',
      title: 'while shown it describes the trigger',
      async run({ page }) {
        await trigger(page).hover();
        await expect(tip(page)).toBeVisible({ timeout: 2000 });
        await expect(trigger(page)).toHaveAccessibleDescription('Saves without publishing');
      },
    },
    {
      id: 'escape-hides',
      title: 'Escape hides it and focus stays on the trigger',
      async run({ page }) {
        await trigger(page).focus();
        await expect(tip(page)).toBeVisible({ timeout: 2000 });
        await page.keyboard.press('Escape');
        await expect(tip(page)).toHaveCount(0);
        await expectFocus(page, 'button', 'Save draft');
      },
    },
    {
      id: 'leave-hides',
      title: 'moving the pointer away hides it',
      async run({ page }) {
        await trigger(page).hover();
        await expect(tip(page)).toBeVisible({ timeout: 2000 });
        await page.mouse.move(2, 2);
        await expect(tip(page)).toHaveCount(0, { timeout: 2000 });
      },
    },
  ])
);
