import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { eventNames, expectFocus, layerClosed } from './common.ts';

const input = (page: import('@playwright/test').Page) =>
  page.getByRole('combobox', { name: 'Assignee' });
const listbox = (page: import('@playwright/test').Page) => page.getByRole('listbox');

scenario(
  'combobox',
  defineRows([
    {
      id: 'input-named',
      title: 'the input is a combobox named by its label, collapsed',
      async run({ page }) {
        await expect(
          page.getByRole('combobox', { name: 'Assignee', expanded: false })
        ).toBeVisible();
      },
    },
    {
      id: 'consumer-ids',
      title: 'consumer ids stay: the label names the input and it controls the list by its own id',
      async run({ page }) {
        await expect(input(page)).toHaveAttribute('id', 'assignee-input');
        await input(page).click();
        await input(page).pressSequentially('a');
        await expect(listbox(page)).toBeVisible();
        await expect(listbox(page)).toHaveAttribute('id', 'assignee-list');
        await expect(input(page)).toHaveAttribute('aria-controls', 'assignee-list');
        await page.keyboard.press('ArrowDown');
        // The active option the input points at exists.
        const active = await input(page).getAttribute('aria-activedescendant');
        expect(active).toBeTruthy();
        await expect(page.locator(`[id="${active}"]`)).toHaveRole('option');
      },
    },
    {
      id: 'typing-filters',
      title: 'typing opens the list and filters it',
      async run({ page }) {
        await input(page).click();
        await input(page).pressSequentially('gra');
        await expect(listbox(page)).toBeVisible();
        await expect(listbox(page).getByRole('option')).toHaveText(['Grace Sample']);
        await expect(
          page.getByRole('combobox', { name: 'Assignee', expanded: true })
        ).toBeVisible();
      },
    },
    {
      id: 'keyboard-select',
      title: 'arrow keys and Enter pick an option, which fills the input',
      async run({ page }) {
        await input(page).click();
        await input(page).pressSequentially('li');
        await expect(listbox(page)).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(input(page)).toHaveValue('Linus Demo');
        expect(await eventNames(page)).toContain('valueChange');
        await expectFocus(page, 'combobox', 'Assignee');
      },
    },
    {
      id: 'escape-closes',
      title: 'Escape closes the list and keeps focus in the input',
      async run({ page }) {
        await input(page).click();
        await input(page).pressSequentially('a');
        await expect(listbox(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'combobox', 'Assignee');
      },
    },
    {
      id: 'external-value-mirrors',
      title: 'a value set from outside shows in the input',
      async run({ page }) {
        await page.getByRole('button', { name: 'Assign Grace' }).click();
        await expect(input(page)).toHaveValue('Grace Sample');
      },
    },
  ])
);
