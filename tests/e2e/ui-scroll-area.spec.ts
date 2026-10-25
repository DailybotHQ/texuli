import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('ScrollArea example has a named native viewport and passes axe in light and dark', async ({
  page,
}) => {
  const example = page.locator('[data-example="texuli-scroll-area"]');

  await page.goto('/?fixture=texuli-scroll-area&mode=light');
  await expect(example.getByRole('region', { name: 'Recent activity' })).toBeVisible();
  await expect(example.locator('[data-tx-scroll-area-viewport]').first()).toHaveAttribute(
    'tabindex',
    '0'
  );
  const light = await new AxeBuilder({ page })
    .include('[data-example="texuli-scroll-area"]')
    .analyze();
  expect(light.violations).toEqual([]);

  await page.goto('/?fixture=texuli-scroll-area&mode=dark');
  await expect(example.getByRole('region', { name: 'Recent activity' })).toBeVisible();
  const dark = await new AxeBuilder({ page })
    .include('[data-example="texuli-scroll-area"]')
    .analyze();
  expect(dark.violations).toEqual([]);
});
