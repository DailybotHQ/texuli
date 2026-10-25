import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { expectFocus, gotoScenarioWith } from './common.ts';

const list = (page: import('@playwright/test').Page) =>
  page.getByRole('tablist', { name: 'Account' });
const tab = (page: import('@playwright/test').Page, name: string) =>
  list(page).getByRole('tab', { name });

scenario(
  'tabs',
  defineRows([
    {
      id: 'roles-and-selection',
      title: 'a named tablist with tabs, the first selected and its panel shown',
      async run({ page }) {
        await expect(list(page).getByRole('tab')).toHaveCount(4);
        await expect(tab(page, 'Profile')).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('tabpanel', { name: 'Profile' })).toHaveText(/Profile details/);
        await expect(tab(page, 'Billing')).toBeDisabled();
      },
    },
    {
      id: 'arrows-activate',
      title: 'arrow keys move between tabs and show their panels, skipping the disabled one',
      async run({ page }) {
        await tab(page, 'Profile').focus();
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'tab', 'Security');
        await expect(page.getByRole('tabpanel', { name: 'Security' })).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'tab', 'Team');
      },
    },
    {
      id: 'home-end',
      title: 'Home and End go to the first and last tab',
      async run({ page }) {
        await tab(page, 'Profile').focus();
        await page.keyboard.press('End');
        await expectFocus(page, 'tab', 'Team');
        await page.keyboard.press('Home');
        await expectFocus(page, 'tab', 'Profile');
      },
    },
    {
      id: 'tab-stop-on-initial-value',
      title: 'starting on a later tab, Tab lands on that selected tab, not the first',
      async run({ page }) {
        await gotoScenarioWith(page, 'tabs', { value: 'security' });
        await expect(tab(page, 'Security')).toHaveAttribute('aria-selected', 'true');
        await page.locator('[data-behavior="before"]').focus();
        await page.keyboard.press('Tab');
        await expectFocus(page, 'tab', 'Security');
      },
    },
    {
      id: 'tab-stop-follows-value',
      title: 'after the selection changes, Tab into the list lands on the newly selected tab',
      async run({ page }) {
        await tab(page, 'Team').click();
        await expect(tab(page, 'Team')).toHaveAttribute('aria-selected', 'true');
        await page.locator('[data-behavior="before"]').focus();
        await page.keyboard.press('Tab');
        await expectFocus(page, 'tab', 'Team');
      },
    },
    {
      id: 'tab-into-panel',
      title: 'Tab leaves the tablist for the active panel',
      async run({ page }) {
        await tab(page, 'Profile').focus();
        await page.keyboard.press('Tab');
        const panel = page.getByRole('tabpanel', { name: 'Profile' });
        // The panel itself or its first control: either is the next stop (APG).
        expect(
          await panel.evaluate((node) => node.contains(node.ownerDocument.activeElement))
        ).toBe(true);
      },
    },
    {
      id: 'click-selects',
      title: 'a click selects a tab',
      async run({ page }) {
        await tab(page, 'Team').click();
        await expect(tab(page, 'Team')).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('tabpanel', { name: 'Team' })).toHaveText(/teammates/);
      },
    },
  ])
);
