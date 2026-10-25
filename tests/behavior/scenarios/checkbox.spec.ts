import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { submitForm } from './common.ts';

const box = (page: import('@playwright/test').Page) =>
  page.getByRole('checkbox', { name: 'Email updates' });

scenario(
  'checkbox',
  defineRows([
    {
      id: 'named-described',
      title: 'it is a checkbox named by its label and described, unchecked',
      async run({ page }) {
        await expect(box(page)).toHaveAccessibleDescription('One fictional digest a week.');
        await expect(box(page)).not.toBeChecked();
      },
    },
    {
      id: 'click-toggles',
      title: 'a click toggles it',
      async run({ page }) {
        await box(page).click();
        await expect(box(page)).toBeChecked();
        await box(page).click();
        await expect(box(page)).not.toBeChecked();
      },
    },
    {
      id: 'space-toggles',
      title: 'Space toggles it',
      async run({ page }) {
        await box(page).focus();
        await page.keyboard.press('Space');
        await expect(box(page)).toBeChecked();
      },
    },
    {
      id: 'label-toggles',
      title: 'a click on its label toggles it',
      async run({ page }) {
        await page.getByText('Email updates', { exact: true }).click();
        await expect(box(page)).toBeChecked();
      },
    },
    {
      id: 'indeterminate',
      title: 'partly selected is announced as mixed',
      async run({ page }) {
        await page.getByRole('button', { name: 'Mark partly selected' }).click();
        await expect(box(page)).toHaveAttribute('aria-checked', 'mixed');
      },
    },
    {
      id: 'disabled',
      title: 'a disabled checkbox cannot change',
      async run({ page }) {
        const locked = page.getByRole('checkbox', { name: 'Locked option' });
        await expect(locked).toBeDisabled();
        await locked.click({ force: true });
        await expect(locked).not.toBeChecked();
      },
    },
    {
      id: 'form-value',
      title: 'checked, its value is submitted with the form',
      async run({ page }) {
        expect(await submitForm(page, 'Save preferences')).not.toHaveProperty('updates');
        await box(page).click();
        expect(await submitForm(page, 'Save preferences')).toMatchObject({ updates: 'yes' });
      },
    },
  ])
);
