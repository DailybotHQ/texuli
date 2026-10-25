import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the fixture app renders, blocks unsafe links and passes axe', async ({ page }) => {
  await page.goto('/?fixture=smoke');
  await expect(page.getByRole('heading', { name: 'Texuli fixtures' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
    'href',
    'https://texuli.com/docs'
  );
  await expect(page.getByRole('link', { name: 'Unsafe link' })).toHaveCount(0);
  await expect(page.locator('[data-blocked-link]')).toHaveText('Unsafe link');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
