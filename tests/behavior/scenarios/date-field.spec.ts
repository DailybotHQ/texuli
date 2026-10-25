import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

scenario(
  'date-field',
  defineRows([
    {
      id: 'named-localized-segments',
      title: 'date and time controls expose labelled groups and named segments',
      async run({ page }) {
        await expect(page.getByRole('group', { name: 'Appointment date' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Appointment time' })).toBeVisible();
        await expect(page.getByRole('spinbutton', { name: /month/i })).toHaveCount(1);
        await expect(page.getByRole('spinbutton', { name: /hour/i })).toHaveCount(1);
      },
    },
    {
      id: 'pointer-focuses-segment',
      title: 'pointer activation focuses a date segment',
      async run({ page }) {
        const month = page.getByRole('spinbutton', { name: /month/i });
        await month.click();
        await expect(month).toBeFocused();
      },
    },
    {
      id: 'keyboard-adjusts-time',
      title: 'keyboard arrows operate a time segment',
      async run({ page }) {
        const minute = page.getByRole('spinbutton', { name: /minute/i });
        await minute.focus();
        await page.keyboard.press('ArrowUp');
        await expect(page.locator('input[name="time"]')).toHaveValue('17:06');
      },
    },
    {
      id: 'touch-focuses-date-segment',
      title: 'touch can focus a date segment on mobile',
      async run({ page }) {
        const target = page.getByRole('spinbutton', { name: 'Day' });
        if ((page.viewportSize()?.width ?? 0) < 600) await target.tap();
        else await target.click();
        await expect(target).toBeFocused();
      },
    },
    {
      id: 'axe-clean',
      title: 'date and time fields have no axe violations',
      async run({ page }) {
        const results = await new AxeBuilder({ page })
          .include('[data-tx-date-field-root], [data-tx-time-field-root]')
          .analyze();
        expect(results.violations).toEqual([]);
      },
    },
  ])
);
