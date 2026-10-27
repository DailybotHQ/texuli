import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

scenario(
  'tree',
  defineRows([
    {
      id: 'tree-exposes-the-apg-pattern-and-supports',
      title:
        'tree exposes the APG pattern and supports keyboard expansion, navigation and selection',
      async run({ page }) {
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
      },
    },
    {
      id: 'tree-supports-pointer-selection-and-lazy',
      title: 'tree supports pointer selection and lazy child loading',
      async run({ page }) {
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
      },
    },
    {
      id: 'tree-supports-touch-selection-on-pixel-7',
      title: 'tree supports touch selection on Pixel 7',
      projects: ['mobile'],
      async run({ page }) {
        const item = page.getByRole('treeitem', { name: 'Asset 1' });
        await item.tap();
        await expect(item).toHaveAttribute('aria-selected', 'true');
      },
    },
    {
      id: 'tree-remains-axe-clean-and-virtualizes-long',
      title: 'tree remains axe-clean and virtualizes long lists',
      async run({ page }) {
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
      },
    },
  ])
);
