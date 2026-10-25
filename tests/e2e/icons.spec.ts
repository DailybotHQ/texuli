import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the icon example has accessible decorative and labelled glyphs', async ({ page }) => {
  await page.goto('/?fixture=texuli-icons');
  const host = page.locator('[data-example-host="texuli-icons"]');
  await expect(host).toBeVisible();
  await expect(host.getByRole('img', { name: 'Information' }).first()).toBeVisible();
  await expect(host.getByRole('img', { name: 'Favorite' }).first()).toBeVisible();
  await expect(host.locator('svg[aria-hidden="true"]').first()).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
