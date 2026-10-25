import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { expectFocus } from './common.ts';

const bold = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Bold' });
const left = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Left' });
const center = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Center' });

scenario(
  'toggle',
  defineRows([
    {
      id: 'toggle-pressed',
      title: 'a toggle starts off and click toggles aria-pressed on and off',
      async run({ page }) {
        await expect(bold(page)).toHaveAttribute('aria-pressed', 'false');
        await bold(page).click();
        await expect(bold(page)).toHaveAttribute('aria-pressed', 'true');
        await bold(page).click();
        await expect(bold(page)).toHaveAttribute('aria-pressed', 'false');
      },
    },
    {
      id: 'toggle-disabled',
      title: 'a disabled toggle cannot change',
      async run({ page }) {
        const locked = page.getByRole('button', { name: 'Locked' });
        await expect(locked).toBeDisabled();
        await locked.click({ force: true });
        await expect(locked).toHaveAttribute('aria-pressed', 'false');
      },
    },
    {
      id: 'group-single',
      title: 'single group selects one value and clears on second press',
      async run({ page }) {
        await left(page).click();
        await expect(left(page)).toHaveAttribute('aria-pressed', 'true');
        await center(page).click();
        await expect(center(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(left(page)).toHaveAttribute('aria-pressed', 'false');
        await center(page).click();
        await expect(center(page)).toHaveAttribute('aria-pressed', 'false');
      },
    },
    {
      id: 'group-multiple',
      title: 'multiple group keeps independent pressed items',
      async run({ page }) {
        const italic = page.getByRole('button', { name: 'Italic' });
        const underline = page.getByRole('button', { name: 'Underline' });
        await italic.click();
        await underline.click();
        await expect(italic).toHaveAttribute('aria-pressed', 'true');
        await expect(underline).toHaveAttribute('aria-pressed', 'true');
      },
    },
    {
      id: 'group-keyboard',
      title: 'arrow keys move focus between group items',
      async run({ page }) {
        await left(page).focus();
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'button', 'Center');
      },
    },
  ])
);
