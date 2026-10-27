import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Show shipping details' });

scenario(
  'collapsible',
  defineRows([
    {
      id: 'disclosure-state',
      title: 'the named button controls collapsed content',
      async run({ page }) {
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger(page)).toHaveAttribute('aria-controls', /.+/);
      },
    },
    {
      id: 'pointer-toggle',
      title: 'pointer activation expands and collapses the content',
      async run({ page }) {
        await trigger(page).click();
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByText('Orders ship within two fictional days.')).toBeVisible();
        await trigger(page).click();
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
      },
    },
    {
      id: 'keyboard-toggle',
      title: 'Space and Enter activate the disclosure button',
      async run({ page }) {
        await trigger(page).focus();
        await page.keyboard.press('Space');
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Enter');
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
      },
    },
    {
      id: 'disabled',
      title: 'a disabled disclosure cannot be opened',
      async run({ page }) {
        const disabled = page.getByRole('button', { name: 'Locked details' });
        await expect(disabled).toBeDisabled();
        await disabled.click({ force: true });
        await expect(disabled).toHaveAttribute('aria-expanded', 'false');
      },
    },
    {
      id: 'axe-clean',
      title: 'the disclosure has no axe violations',
      async run({ page }) {
        const result = await new AxeBuilder({ page })
          .include('[aria-label="Collapsible examples"]')
          .analyze();
        expect(result.violations).toEqual([]);
      },
    },
    {
      id: 'touch-toggles',
      title: 'toggles through touch input on the phone',
      projects: ['mobile'],
      async run({ page }) {
        const button = trigger(page);
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await button.tap();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
      },
    },
  ])
);
