import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { pointerOutside } from '../harness/oracle.ts';
import { eventNames, expectFocus, layerClosed } from './common.ts';

const trigger = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });
const expanded = (page: Page, name: string) =>
  page.getByRole('menuitem', { name, exact: true, expanded: true });
const menu = (page: Page) => page.getByRole('menu');

async function openFile(page: Page) {
  await trigger(page, 'File').focus();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeVisible();
}

scenario(
  'menubar',
  defineRows([
    {
      id: 'roles',
      title: 'a named menubar of menuitems that open menus, collapsed',
      async run({ page }) {
        await expect(page.getByRole('menubar', { name: 'Application' })).toBeVisible();
        await expect(trigger(page, 'File')).toHaveAttribute('aria-haspopup', 'menu');
        await expect(page.getByRole('menuitem', { name: 'File', expanded: false })).toBeVisible();
      },
    },
    {
      id: 'one-tab-stop',
      title: 'the menubar is one Tab stop: Tab leaves it from any trigger',
      async run({ page }) {
        await trigger(page, 'File').focus();
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'menuitem', 'Edit');
        await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(trigger(page, 'View')).not.toBeFocused();
        await expect(trigger(page, 'File')).not.toBeFocused();
        await expect(trigger(page, 'Edit')).not.toBeFocused();
      },
    },
    {
      id: 'arrows-between-triggers',
      title: 'ArrowRight and ArrowLeft move between triggers, skipping the disabled one',
      async run({ page }) {
        await trigger(page, 'File').focus();
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'menuitem', 'Edit');
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'menuitem', 'View');
        await page.keyboard.press('ArrowLeft');
        await expectFocus(page, 'menuitem', 'Edit');
        await layerClosed(page);
      },
    },
    {
      id: 'open-first-item',
      title: 'Enter on a trigger opens its menu on the first item',
      async run({ page }) {
        await openFile(page);
        await expectFocus(page, 'menuitem', 'New');
        await expect(expanded(page, 'File')).toBeVisible();
      },
    },
    {
      id: 'arrows-carry-menu',
      title: 'in an open menu, ArrowRight and ArrowLeft open the next and previous menus',
      async run({ page }) {
        await openFile(page);
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'menuitem', 'Undo');
        await expect(expanded(page, 'Edit')).toBeVisible();
        await expect(menu(page)).toHaveCount(1);
        await page.keyboard.press('ArrowLeft');
        await expectFocus(page, 'menuitem', 'New');
        await expect(expanded(page, 'File')).toBeVisible();
      },
    },
    {
      id: 'submenu',
      title: 'ArrowRight on a submenu trigger opens the submenu; ArrowLeft closes it',
      async run({ page }) {
        await openFile(page);
        await page.keyboard.press('End');
        await expectFocus(page, 'menuitem', 'Share');
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'menuitem', 'Email');
        await page.keyboard.press('ArrowLeft');
        await expectFocus(page, 'menuitem', 'Share');
        await expect(expanded(page, 'File')).toBeVisible();
      },
    },
    {
      id: 'escape',
      title: 'Escape closes the menu and returns focus to its trigger',
      async run({ page }) {
        await openFile(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'menuitem', 'File');
      },
    },
    {
      id: 'hover-after-open',
      title: 'after a click opens one menu, hovering another trigger switches to it',
      async run({ page }) {
        // Hover is a mouse behavior; touch projects have nothing to check here.
        if (test.info().project.use.hasTouch) return;
        await trigger(page, 'File').click();
        await expect(expanded(page, 'File')).toBeVisible();
        await trigger(page, 'View').hover();
        await expect(expanded(page, 'View')).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Zoom in' })).toBeVisible();
      },
    },
    {
      id: 'outside-press',
      title: 'a press outside closes the open menu',
      async run({ page }) {
        await openFile(page);
        await pointerOutside(page);
        await expect(menu(page)).toHaveCount(0);
        await expect(page.getByRole('menuitem', { name: 'File', expanded: false })).toBeVisible();
      },
    },
    {
      id: 'select',
      title: 'Enter on an item runs it and closes the menu',
      async run({ page }) {
        await openFile(page);
        await page.keyboard.press('Enter');
        await layerClosed(page);
        await expect.poll(() => eventNames(page)).toContain('select');
      },
    },
    {
      id: 'touch',
      title: 'a tap opens a menu and a tap on an item runs it',
      async run({ page }) {
        if (!test.info().project.use.hasTouch) return;
        await trigger(page, 'Edit').tap();
        await expect(expanded(page, 'Edit')).toBeVisible();
        await page.getByRole('menuitem', { name: 'Redo' }).tap();
        await layerClosed(page);
      },
    },
    {
      id: 'axe',
      title: 'axe finds no violations with a menu open',
      async run({ page }) {
        await openFile(page);
        // Scoped to the component: the behavior frame itself has no h1 or landmarks.
        const results = await new AxeBuilder({ page })
          .include('[role="menubar"]')
          .include('[role="menu"]')
          .analyze();
        expect(
          results.violations.map(
            (violation) =>
              `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
          )
        ).toEqual([]);
      },
    },
  ])
);
