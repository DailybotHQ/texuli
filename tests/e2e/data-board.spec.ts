import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('data-board move menu relocates a card and stays axe-clean', async ({ page }) => {
  const example = page.locator('[data-example="data-board"]');
  await page.goto('/?fixture=data-board&mode=light', { waitUntil: 'networkidle' });
  await expect(example.locator('#data-board-title')).toBeVisible({ timeout: 20_000 });
  await expect(example.locator('.tx-board').first()).toBeVisible({ timeout: 20_000 });

  const board = example.locator('.tx-board').first();
  const card = board.locator('[data-item-id="task-1"]');
  await expect(card).toBeVisible();
  await card.locator('[data-board-move-menu]').click();
  await expect(example.locator('[data-board-move-menu-chunk]')).toBeAttached({
    timeout: 15_000,
  });
  // Lazy chunk replaces light triggers; open again if the first click only loaded.
  const menuItem = page.getByRole('menuitem', { name: 'Done — top' });
  if (!(await menuItem.isVisible().catch(() => false))) {
    await board.locator('[data-item-id="task-1"] [data-board-move-menu]').click();
  }
  await expect(menuItem).toBeVisible({ timeout: 10_000 });
  await menuItem.click();

  await expect(board.locator('[data-board-cell][aria-label="Done"]')).toContainText(
    'Map the core flow'
  );
  await expect(board.locator('.tx-board__status')).toContainText('Moved Map the core flow to Done');

  const light = await new AxeBuilder({ page }).include('[data-example="data-board"]').analyze();
  expect(light.violations.map((v) => v.id)).toEqual([]);

  await page.goto('/?fixture=data-board&mode=dark', { waitUntil: 'networkidle' });
  await expect(example.locator('#data-board-title')).toBeVisible({ timeout: 20_000 });
  await expect(example.locator('.tx-board').first()).toBeVisible({ timeout: 20_000 });
  const dark = await new AxeBuilder({ page }).include('[data-example="data-board"]').analyze();
  expect(dark.violations.map((v) => v.id)).toEqual([]);
});
