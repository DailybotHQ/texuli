import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gotoScenario } from '../harness/oracle.ts';

async function openTree(page: import('@playwright/test').Page): Promise<void> {
  await gotoScenario(page, 'tree');
}

test('tree exposes the APG pattern and supports keyboard expansion, navigation and selection', async ({
  page,
}) => {
  await openTree(page);
  const tree = page.getByRole('tree', { name: 'Workspace files' });
  const workspace = page.getByRole('treeitem', { name: 'Workspace' });
  await tree.focus();
  await page.keyboard.press('ArrowRight');
  await expect(workspace).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  const readme = page.getByRole('treeitem', { name: 'Readme.md' });
  await expect(tree).toHaveAttribute(
    'aria-activedescendant',
    (await readme.getAttribute('id')) ?? ''
  );
  await page.keyboard.press('Space');
  await expect(readme).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('r');
  const roadmap = page.getByRole('treeitem', { name: 'Roadmap.md' });
  await expect(tree).toHaveAttribute(
    'aria-activedescendant',
    (await roadmap.getAttribute('id')) ?? ''
  );
  await page.keyboard.press('ArrowLeft');
  await expect(tree).toHaveAttribute(
    'aria-activedescendant',
    (await workspace.getAttribute('id')) ?? ''
  );
  await page.keyboard.press('ArrowLeft');
  await expect(workspace).toHaveAttribute('aria-expanded', 'false');
});

test('tree supports pointer selection and lazy child loading', async ({ page }) => {
  await openTree(page);
  const tree = page.getByRole('tree', { name: 'Workspace files' });
  const archive = page.getByRole('treeitem', { name: 'Archive', exact: true });
  await archive.click();
  await expect(archive).toHaveAttribute('aria-selected', 'true');
  await archive.locator('[data-tree-toggle]').click();
  await expect(page.getByRole('treeitem', { name: 'Archive report' })).toBeVisible();
  await expect(archive).toHaveAttribute('aria-expanded', 'true');
  await expect(tree).toHaveAttribute(
    'aria-activedescendant',
    (await archive.getAttribute('id')) ?? ''
  );
});

test('tree supports touch selection on Pixel 7', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile',
    'Touch activation is exercised on the Pixel 7 project.'
  );
  await openTree(page);
  const item = page.getByRole('treeitem', { name: 'Asset 1' });
  await item.tap();
  await expect(item).toHaveAttribute('aria-selected', 'true');
});

test('tree remains axe-clean and virtualizes long lists', async ({ page }) => {
  await openTree(page);
  const tree = page.getByRole('tree', { name: 'Workspace files' });
  await expect(tree.locator('[role="treeitem"]')).toHaveCount(10);
  const result = await new AxeBuilder({ page }).include('[role="tree"]').analyze();
  expect(result.violations).toEqual([]);

  await tree.focus();
  await page.keyboard.press('End');
  const last = page.getByRole('treeitem', { name: 'Asset 60' });
  await expect(last).toBeVisible();
  await expect(tree).toHaveAttribute(
    'aria-activedescendant',
    (await last.getAttribute('id')) ?? ''
  );
  await expect(tree.locator('[role="treeitem"]')).toHaveCount(10);
});
