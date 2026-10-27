import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const listbox = (page: import('@playwright/test').Page, name = 'Colors') =>
  page.getByRole('listbox', { name, exact: true });
const option = (page: import('@playwright/test').Page, name: string, group = 'Colors') =>
  listbox(page, group).getByRole('option', { name });
const isSelected = async (target: import('@playwright/test').Locator) =>
  target.evaluate((element) =>
    element instanceof HTMLOptionElement
      ? element.selected
      : element.getAttribute('aria-selected') === 'true'
  );
const isDisabled = async (target: import('@playwright/test').Locator) =>
  target.evaluate((element) =>
    element instanceof HTMLOptionElement
      ? element.disabled
      : element.getAttribute('aria-disabled') === 'true'
  );

scenario(
  'listbox',
  defineRows([
    {
      id: 'named-and-selected',
      title: 'the single listbox is named and exposes its selected option',
      async run({ page }) {
        await expect(listbox(page)).toBeVisible();
        expect(await isSelected(option(page, 'Amber'))).toBe(true);
        expect(await isDisabled(option(page, 'Coral'))).toBe(true);
      },
    },
    {
      id: 'pointer-selection',
      title: 'pointer activation selects an enabled option',
      async run({ page }) {
        if ((await listbox(page).evaluate((element) => element.tagName)) === 'SELECT') {
          await listbox(page).selectOption('blue');
        } else {
          await option(page, 'Blue').click();
        }
        expect(await isSelected(option(page, 'Blue'))).toBe(true);
        expect(await isSelected(option(page, 'Amber'))).toBe(false);
      },
    },
    {
      id: 'keyboard-navigation',
      title: 'arrow keys move the active descendant and selection',
      async run({ page }) {
        if ((await listbox(page).evaluate((element) => element.tagName)) === 'SELECT') {
          await listbox(page).selectOption('amber');
        } else {
          await option(page, 'Amber').click();
        }
        await listbox(page).focus();
        await page.keyboard.press('ArrowDown');
        expect(await isSelected(option(page, 'Blue'))).toBe(true);
        if ((await listbox(page).evaluate((element) => element.tagName)) !== 'SELECT') {
          await expect(listbox(page)).toHaveAttribute(
            'aria-activedescendant',
            (await option(page, 'Blue').getAttribute('id')) ?? ''
          );
        }
      },
    },
    {
      id: 'multiple-selection',
      title: 'the multiple listbox can select more than one option',
      async run({ page }) {
        const multiple = listbox(page, 'Multiple colors');
        if ((await multiple.evaluate((element) => element.tagName)) === 'SELECT') {
          await multiple.selectOption(['amber', 'jade']);
        } else {
          await option(page, 'Jade', 'Multiple colors').click();
        }
        expect(await isSelected(option(page, 'Jade', 'Multiple colors'))).toBe(true);
      },
    },
    {
      id: 'disabled-option',
      title: 'disabled options cannot be selected',
      async run({ page }) {
        const coral = option(page, 'Coral');
        if ((await listbox(page).evaluate((element) => element.tagName)) !== 'SELECT') {
          await coral.click({ force: true });
        }
        expect(await isSelected(option(page, 'Coral'))).toBe(false);
      },
    },
    {
      id: 'axe-clean',
      title: 'the listbox examples have no axe violations',
      async run({ page }) {
        const result = await new AxeBuilder({ page })
          .include('[aria-label="Listbox examples"]')
          .analyze();
        expect(result.violations).toEqual([]);
      },
    },
    {
      id: 'touch-selects',
      title: 'selects by touch on the phone',
      projects: ['mobile'],
      async run({ page }) {
        await option(page, 'Jade').tap();
        expect(await isSelected(option(page, 'Jade'))).toBe(true);
      },
    },
  ])
);
