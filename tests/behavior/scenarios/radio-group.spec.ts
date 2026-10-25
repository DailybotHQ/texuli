import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusedElement } from '../harness/oracle.ts';
import { expectFocus, gotoScenarioWith, submitForm } from './common.ts';

const group = (page: import('@playwright/test').Page) =>
  page.getByRole('radiogroup', { name: 'Delivery' });
const radio = (page: import('@playwright/test').Page, name: string) =>
  group(page).getByRole('radio', { name });

scenario(
  'radio-group',
  defineRows([
    {
      id: 'named-group',
      title: 'a radiogroup named by its label, with named radios and one checked',
      async run({ page }) {
        await expect(group(page).getByRole('radio')).toHaveCount(4);
        await expect(radio(page, 'Standard')).toBeChecked();
        await expect(radio(page, 'Pickup')).toBeDisabled();
      },
    },
    {
      id: 'one-tab-stop',
      title: 'the group is one Tab stop, on the checked radio',
      async run({ page }) {
        await page.locator('[data-behavior="before"]').focus();
        await page.keyboard.press('Tab');
        await expectFocus(page, 'radio', 'Standard');
        await page.keyboard.press('Tab');
        // The next Tab leaves the group (where it lands depends on the browser's Tab order).
        expect((await focusedElement(page)).role).not.toBe('radio');
      },
    },
    {
      id: 'tab-stop-on-initial-value',
      title: 'starting on a later radio, Tab lands on that checked radio, not the first',
      async run({ page }) {
        await gotoScenarioWith(page, 'radio-group', { value: 'express' });
        await expect(radio(page, 'Express')).toBeChecked();
        await page.locator('[data-behavior="before"]').focus();
        await page.keyboard.press('Tab');
        await expectFocus(page, 'radio', 'Express');
      },
    },
    {
      id: 'tab-stop-follows-value',
      title: 'after the value changes, Tab into the group lands on the newly checked radio',
      async run({ page }) {
        await radio(page, 'Drone').click();
        await expect(radio(page, 'Drone')).toBeChecked();
        await page.locator('[data-behavior="before"]').focus();
        await page.keyboard.press('Tab');
        await expectFocus(page, 'radio', 'Drone');
      },
    },
    {
      id: 'arrows-select',
      title: 'arrow keys move and select, skipping the disabled radio',
      async run({ page }) {
        await radio(page, 'Standard').focus();
        await page.keyboard.press('ArrowDown');
        await expectFocus(page, 'radio', 'Express');
        await expect(radio(page, 'Express')).toBeChecked();
        await page.keyboard.press('ArrowDown');
        await expectFocus(page, 'radio', 'Drone');
        await expect(radio(page, 'Drone')).toBeChecked();
      },
    },
    {
      id: 'click-selects',
      title: 'a click selects a radio',
      async run({ page }) {
        await radio(page, 'Express').click();
        await expect(radio(page, 'Express')).toBeChecked();
        await expect(radio(page, 'Standard')).not.toBeChecked();
      },
    },
    {
      id: 'form-value',
      title: 'the selected value is submitted with the form',
      async run({ page }) {
        await radio(page, 'Drone').click();
        expect(await submitForm(page, 'Confirm delivery')).toMatchObject({ delivery: 'drone' });
      },
    },
  ])
);
