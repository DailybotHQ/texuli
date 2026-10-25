import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('TreeView example supports keyboard navigation and passes axe in light and dark', async ({
  page,
}) => {
  await page.goto('/?fixture=texuli-tree&mode=light');
  const example = page.locator('[data-example="texuli-tree"]');
  const tree = example.getByRole('tree', { name: 'Workspace pages', exact: true });
  await expect(tree).toBeVisible();
  await expect(tree.getByRole('treeitem', { name: 'Archive' })).toHaveAttribute(
    'data-disabled',
    ''
  );
  await tree.focus();
  await tree.press('ArrowDown');
  await expect(tree).toHaveAttribute('aria-activedescendant', /item-guides/);

  const light = await new AxeBuilder({ page }).include('[data-example="texuli-tree"]').analyze();
  expect(light.violations).toEqual([]);

  await page.goto('/?fixture=texuli-tree&mode=dark');
  await expect(
    page.locator('[data-example="texuli-tree"]').getByRole('tree').first()
  ).toBeVisible();
  const dark = await new AxeBuilder({ page }).include('[data-example="texuli-tree"]').analyze();
  expect(dark.violations).toEqual([]);
});
