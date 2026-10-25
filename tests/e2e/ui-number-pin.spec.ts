import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('NumberField and PinInput example passes axe in light and dark', async ({ page }) => {
  const example = page.locator('[data-example="texuli-number-pin"]');

  await page.goto('/?fixture=texuli-number-pin&mode=light');
  await expect(example.getByRole('spinbutton', { name: 'Quantity' }).first()).toBeVisible();
  await expect(example.getByRole('textbox', { name: 'Verification code' }).first()).toBeVisible();
  const light = await new AxeBuilder({ page })
    .include('[data-example="texuli-number-pin"]')
    .analyze();
  expect(light.violations).toEqual([]);

  await page.goto('/?fixture=texuli-number-pin&mode=dark');
  await expect(example.getByRole('spinbutton', { name: 'Quantity' }).first()).toBeVisible();
  const dark = await new AxeBuilder({ page })
    .include('[data-example="texuli-number-pin"]')
    .analyze();
  expect(dark.violations).toEqual([]);
});
