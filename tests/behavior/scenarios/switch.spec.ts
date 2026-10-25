import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { submitForm } from './common.ts';

const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('switch', { name: 'Airplane mode' });

scenario(
  'switch',
  defineRows([
    {
      id: 'named-described',
      title: 'it is a switch named by its label and described, off',
      async run({ page }) {
        await expect(toggle(page)).toHaveAccessibleDescription('Turns off every fictional radio.');
        await expect(toggle(page)).not.toBeChecked();
      },
    },
    {
      id: 'click-toggles',
      title: 'a click turns it on and off',
      async run({ page }) {
        await toggle(page).click();
        await expect(toggle(page)).toBeChecked();
        await toggle(page).click();
        await expect(toggle(page)).not.toBeChecked();
      },
    },
    {
      id: 'keys-toggle',
      title: 'Space and Enter toggle it',
      async run({ page }) {
        await toggle(page).focus();
        await page.keyboard.press('Space');
        await expect(toggle(page)).toBeChecked();
        await page.keyboard.press('Enter');
        await expect(toggle(page)).not.toBeChecked();
      },
    },
    {
      id: 'label-toggles',
      title: 'a click on its label toggles it',
      async run({ page }) {
        await page.getByText('Airplane mode', { exact: true }).click();
        await expect(toggle(page)).toBeChecked();
      },
    },
    {
      id: 'disabled',
      title: 'a disabled switch cannot change',
      async run({ page }) {
        const locked = page.getByRole('switch', { name: 'Managed setting' });
        await expect(locked).toBeDisabled();
        await locked.click({ force: true });
        await expect(locked).not.toBeChecked();
      },
    },
    {
      id: 'form-value',
      title: 'on, its value is submitted with the form',
      async run({ page }) {
        await toggle(page).click();
        expect(await submitForm(page, 'Save settings')).toMatchObject({ airplane: 'on' });
      },
    },
  ])
);
