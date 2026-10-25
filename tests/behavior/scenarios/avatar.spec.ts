import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const root = (page: import('@playwright/test').Page) =>
  page.locator('[data-behavior-avatar="root"]');
const image = (page: import('@playwright/test').Page) =>
  page.locator('[data-behavior-avatar="image"]');
const fallback = (page: import('@playwright/test').Page) =>
  page.locator('[data-behavior-avatar="fallback"]');

scenario(
  'avatar',
  defineRows([
    {
      id: 'fallback-while-loading',
      title: 'fallback is visible before the image has loaded',
      async run({ page }) {
        // No Image mounted yet: root stays loading and Fallback is shown.
        await expect(root(page)).toHaveAttribute('data-state', 'loading');
        await expect(fallback(page)).toBeVisible();
        await expect(fallback(page)).toContainText('AE');
        await expect(image(page)).toHaveCount(0);
      },
    },
    {
      id: 'image-after-load',
      title: 'a successful load reveals the image and hides the fallback',
      async run({ page }) {
        await page.getByRole('button', { name: 'Simulate load' }).click();
        await expect(root(page)).toHaveAttribute('data-state', 'loaded', { timeout: 5_000 });
        await expect(image(page)).toBeVisible();
        await expect(image(page)).toHaveAttribute('alt', 'Ada Example');
        await expect(fallback(page)).toHaveCount(0);
      },
    },
    {
      id: 'fallback-on-error',
      title: 'a failed load keeps the fallback and marks error',
      async run({ page }) {
        await page.getByRole('button', { name: 'Simulate error' }).click();
        await expect(root(page)).toHaveAttribute('data-state', 'error', { timeout: 5_000 });
        await expect(fallback(page)).toBeVisible();
        // The image unmounts on error; the fallback stays.
        await expect(fallback(page)).toContainText('AE');
      },
    },
  ])
);
