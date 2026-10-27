import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusedElement } from '../harness/oracle.ts';
import { eventNames, expectFocus, layer, layerClosed, sampleOpenToFocus } from './common.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Actions' });
const menu = (page: import('@playwright/test').Page) => page.getByRole('menu');
async function openWithKeyboard(page: import('@playwright/test').Page) {
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeVisible();
}

scenario(
  'dropdown-menu',
  defineRows([
    {
      id: 'open-arrows-typeahead-group',
      title:
        'the trigger says it opens a menu (collapsed, then expanded); Enter focuses the first item; arrows skip the disabled item; typeahead moves; the group is named by its heading',
      async run({ page }) {
        await expect(trigger(page)).toHaveAttribute('aria-haspopup', 'menu');
        await expect(page.getByRole('button', { name: 'Actions', expanded: false })).toBeVisible();
        await openWithKeyboard(page);
        await expect(page.getByRole('button', { name: 'Actions', expanded: true })).toBeVisible();
        await expectFocus(page, 'menuitem', 'Rename');
        await expect(menu(page).getByRole('group', { name: 'Danger zone' })).toBeVisible();
        const stops: string[] = [];
        for (let index = 0; index < 3; index += 1) {
          await page.keyboard.press('ArrowDown');
          stops.push((await focusedElement(page)).name);
        }
        expect(stops).toEqual(['Duplicate', 'Delete', 'Rename']);
        await expect(menu(page).getByRole('menuitem', { name: 'Archive' })).toHaveAttribute(
          'aria-disabled',
          'true'
        );
        await page.keyboard.press('d');
        await expectFocus(page, 'menuitem', 'Duplicate');
      },
    },
    {
      id: 'escape-select-outside',
      title:
        'Escape closes it and focus returns to the trigger; choosing an item runs it, closes the menu and returns focus; a pointer press outside closes it',
      async run({ page, recordOpenToFocus }) {
        await openWithKeyboard(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Actions');
        await openWithKeyboard(page);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await layerClosed(page);
        expect(await eventNames(page)).toContain('select');
        await expectFocus(page, 'button', 'Actions');
        await trigger(page).click();
        await expect(layer(page)).toBeVisible();
        await page.mouse.click(4, 4);
        await layerClosed(page);
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
  ])
);
