import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const bar = (page: import('@playwright/test').Page) =>
  page.getByRole('progressbar', { name: 'Upload' });

scenario(
  'progress',
  defineRows([
    {
      id: 'named-value',
      title: 'a progressbar named by its label, with its value and range',
      async run({ page }) {
        await expect(bar(page)).toHaveAttribute('aria-valuenow', '40');
        await expect(bar(page)).toHaveAttribute('aria-valuemax', '100');
        await expect(bar(page)).toHaveAttribute('aria-valuemin', '0');
      },
    },
    {
      id: 'value-updates',
      title: 'a new value is announced',
      async run({ page }) {
        await page.getByRole('button', { name: 'Advance upload' }).click();
        await expect(bar(page)).toHaveAttribute('aria-valuenow', '70');
      },
    },
    {
      id: 'indeterminate',
      title: 'unknown progress has no current value',
      async run({ page }) {
        await page.getByRole('button', { name: 'Unknown progress' }).click();
        await expect(bar(page)).not.toHaveAttribute('aria-valuenow', /.*/);
      },
    },
  ])
);
