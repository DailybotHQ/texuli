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
      id: 'trigger-state',
      title: 'the trigger says it opens a menu, collapsed then expanded',
      async run({ page }) {
        await expect(trigger(page)).toHaveAttribute('aria-haspopup', 'menu');
        await expect(page.getByRole('button', { name: 'Actions', expanded: false })).toBeVisible();
        await openWithKeyboard(page);
        await expect(page.getByRole('button', { name: 'Actions', expanded: true })).toBeVisible();
      },
    },
    {
      id: 'focus-first-item',
      title: 'opening with Enter focuses the first item',
      async run({ page, recordOpenToFocus }) {
        await openWithKeyboard(page);
        await expectFocus(page, 'menuitem', 'Rename');
        await page.keyboard.press('Escape');
        await layerClosed(page);
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'arrows-skip-disabled',
      title: 'arrow keys move through items and skip the disabled one',
      async run({ page }) {
        await openWithKeyboard(page);
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
      },
    },
    {
      id: 'typeahead',
      title: 'typing a letter moves to the matching item',
      async run({ page }) {
        await openWithKeyboard(page);
        await page.keyboard.press('d');
        await expectFocus(page, 'menuitem', 'Duplicate');
      },
    },
    {
      id: 'group-labelled',
      title: 'the group is named by its heading',
      async run({ page }) {
        await openWithKeyboard(page);
        await expect(menu(page).getByRole('group', { name: 'Danger zone' })).toBeVisible();
      },
    },
    {
      id: 'select-closes-returns-focus',
      title: 'choosing an item runs it, closes the menu and returns focus',
      async run({ page }) {
        await openWithKeyboard(page);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await layerClosed(page);
        expect(await eventNames(page)).toContain('select');
        await expectFocus(page, 'button', 'Actions');
      },
    },
    {
      id: 'escape-returns-focus',
      title: 'Escape closes it and focus returns to the trigger',
      async run({ page }) {
        await openWithKeyboard(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Actions');
      },
    },
    {
      id: 'outside-pointer-closes',
      title: 'a pointer press outside closes it',
      async run({ page }) {
        await trigger(page).click();
        await expect(layer(page)).toBeVisible();
        await page.mouse.click(4, 4);
        await layerClosed(page);
      },
    },
  ])
);
