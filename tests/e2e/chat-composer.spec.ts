import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('chat composer example is keyboard usable and passes axe', async ({ page }) => {
  await page.goto('/?fixture=chat-composer&mode=light');
  const composer = page.locator('[data-example-host="chat-composer"]');
  const field = composer.getByRole('textbox', { name: 'Message' });
  await expect(field).toBeVisible();
  await expect(composer.getByRole('button', { name: 'Attach a file' })).toBeVisible();
  await expect(composer.getByRole('status')).toContainText('Jordan is typing');

  await field.fill('A first line');
  await field.press('Shift+Enter');
  await field.type('A second line');
  await expect(field).toHaveValue('A first line\nA second line');
  await field.press('Enter');
  await expect(composer.getByRole('list', { name: 'Sent messages' })).toContainText(
    'A first line\nA second line'
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.goto('/?fixture=chat-composer&mode=dark');
  await expect(
    page.locator('[data-example-host="chat-composer"]').getByRole('textbox', { name: 'Message' })
  ).toBeVisible();
  const darkResults = await new AxeBuilder({ page }).analyze();
  expect(darkResults.violations).toEqual([]);
});
