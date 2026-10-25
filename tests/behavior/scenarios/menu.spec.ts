import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { eventNames, expectFocus, layer, layerClosed, sampleOpenToFocus } from './common.ts';

const trigger = (page: Page) => page.getByRole('button', { name: 'View' });
const menus = (page: Page) => page.getByRole('menu');
const item = (page: Page, role: string, name: string) =>
  page.getByRole(role as 'menuitem', { name });

async function openWithKeyboard(page: Page) {
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  await expect(menus(page)).toHaveCount(1);
  await expectFocus(page, 'menuitem', 'New file');
}

async function openSubmenuWithKeyboard(page: Page) {
  await openWithKeyboard(page);
  await page.keyboard.press('ArrowDown');
  await expectFocus(page, 'menuitem', 'Export');
  await page.keyboard.press('ArrowRight');
  await expect(menus(page)).toHaveCount(2);
  await expectFocus(page, 'menuitem', 'PNG');
}

scenario(
  'menu',
  defineRows([
    {
      id: 'open-first-item',
      title: 'Enter opens the menu on its first item; the trigger says it is expanded',
      async run({ page, recordOpenToFocus }) {
        await expect(trigger(page)).toHaveAttribute('aria-haspopup', 'menu');
        await openWithKeyboard(page);
        await expect(page.getByRole('button', { name: 'View', expanded: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await layerClosed(page);
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'arrow-up-opens-on-last',
      title: 'ArrowUp on the trigger opens the menu on its last item',
      async run({ page }) {
        await trigger(page).focus();
        await page.keyboard.press('ArrowUp');
        await expectFocus(page, 'menuitemradio', 'Spacious');
      },
    },
    {
      id: 'home-end',
      title: 'Home and End move to the first and last items',
      async run({ page }) {
        await openWithKeyboard(page);
        await page.keyboard.press('End');
        await expectFocus(page, 'menuitemradio', 'Spacious');
        await page.keyboard.press('Home');
        await expectFocus(page, 'menuitem', 'New file');
      },
    },
    {
      id: 'typeahead',
      title: 'typing letters moves to the matching item',
      async run({ page }) {
        await openWithKeyboard(page);
        await page.keyboard.type('sh');
        await expectFocus(page, 'menuitemcheckbox', 'Show grid');
      },
    },
    {
      id: 'checkbox-item',
      title: 'a checkbox item toggles its checked state and keeps the menu open',
      async run({ page }) {
        await openWithKeyboard(page);
        const grid = item(page, 'menuitemcheckbox', 'Show grid');
        await expect(grid).toHaveAttribute('aria-checked', 'false');
        await page.keyboard.type('sh');
        await expectFocus(page, 'menuitemcheckbox', 'Show grid');
        await page.keyboard.press('Enter');
        await expect(grid).toHaveAttribute('aria-checked', 'true');
        await expect(menus(page)).toHaveCount(1);
        await grid.click();
        await expect(grid).toHaveAttribute('aria-checked', 'false');
        expect((await eventNames(page)).filter((name) => name === 'checked')).toHaveLength(2);
      },
    },
    {
      id: 'radio-items',
      title: 'radio items check one value in a group named by its heading',
      async run({ page }) {
        await openWithKeyboard(page);
        await expect(menus(page).getByRole('group', { name: 'Density' })).toBeVisible();
        await expect(item(page, 'menuitemradio', 'Comfortable')).toHaveAttribute(
          'aria-checked',
          'true'
        );
        await item(page, 'menuitemradio', 'Spacious').click();
        await expect(item(page, 'menuitemradio', 'Spacious')).toHaveAttribute(
          'aria-checked',
          'true'
        );
        await expect(item(page, 'menuitemradio', 'Comfortable')).toHaveAttribute(
          'aria-checked',
          'false'
        );
        expect(await eventNames(page)).toContain('density');
      },
    },
    {
      id: 'submenu-keyboard',
      title: 'ArrowRight opens the submenu on its first item; ArrowLeft returns to its trigger',
      async run({ page }) {
        await openSubmenuWithKeyboard(page);
        await expect(item(page, 'menuitem', 'Export')).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('ArrowLeft');
        await expect(menus(page)).toHaveCount(1);
        await expectFocus(page, 'menuitem', 'Export');
      },
    },
    {
      id: 'submenu-escape',
      title: 'Escape closes the submenu only and returns focus to its trigger',
      async run({ page }) {
        await openSubmenuWithKeyboard(page);
        await page.keyboard.press('Escape');
        await expect(menus(page)).toHaveCount(1);
        await expectFocus(page, 'menuitem', 'Export');
      },
    },
    {
      id: 'submenu-select',
      title: 'choosing a submenu item closes every menu and returns focus to the trigger',
      async run({ page }) {
        await openSubmenuWithKeyboard(page);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await layerClosed(page);
        await expect(menus(page)).toHaveCount(0);
        expect(await eventNames(page)).toContain('select');
        await expectFocus(page, 'button', 'View');
      },
    },
    {
      id: 'submenu-pointer',
      title: 'resting the pointer on the submenu trigger opens the submenu',
      async run({ page }) {
        await trigger(page).click();
        await expect(layer(page)).toBeVisible();
        await item(page, 'menuitem', 'Export').hover();
        await expect(menus(page)).toHaveCount(2);
      },
    },
    {
      id: 'submenu-grace',
      title: 'moving diagonally to the submenu over another item keeps the submenu open',
      async run({ page }) {
        await trigger(page).click();
        const exportItem = item(page, 'menuitem', 'Export');
        const box = await exportItem.boundingBox();
        if (!box) throw new Error('no Export box');
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 4 });
        await expect(menus(page)).toHaveCount(2);
        const target = await item(page, 'menuitem', 'WebM').boundingBox();
        if (!target) throw new Error('no WebM box');
        // The straight path crosses "Show grid" in the parent menu on the way.
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {
          steps: 12,
        });
        await expect(menus(page)).toHaveCount(2);
        await expectFocus(page, 'menuitem', 'WebM');
      },
    },
    {
      id: 'outside-pointer-closes-all',
      title: 'a pointer press outside closes the menu and its open submenu',
      async run({ page }) {
        await openSubmenuWithKeyboard(page);
        await page.mouse.click(4, 4);
        await layerClosed(page);
        await expect(menus(page)).toHaveCount(0);
      },
    },
  ])
);
