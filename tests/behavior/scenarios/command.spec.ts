import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { eventNames } from './common.ts';

const search = (page: import('@playwright/test').Page) => page.getByPlaceholder('Type a command');
const options = (page: import('@playwright/test').Page) => page.getByRole('option');

scenario(
  'command',
  defineRows([
    {
      id: 'named-list',
      title: 'the list and its groups are named',
      async run({ page }) {
        await expect(page.getByRole('listbox')).toBeVisible();
        await expect(page.getByRole('group', { name: 'Navigation' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Actions' })).toBeVisible();
      },
    },
    {
      id: 'typing-filters',
      title: 'typing filters the items',
      async run({ page }) {
        await search(page).fill('settings');
        await expect(options(page)).toHaveText(['Open settings']);
      },
    },
    {
      id: 'empty-state',
      title: 'no match shows the empty state',
      async run({ page }) {
        await search(page).fill('zzz');
        await expect(options(page)).toHaveCount(0);
        await expect(page.getByText('No results')).toBeVisible();
      },
    },
    {
      id: 'arrows-move-selection',
      title: 'arrow keys move the selected item, looping',
      async run({ page }) {
        await search(page).focus();
        await expect(
          page.getByRole('option', { name: 'Open inbox', selected: true })
        ).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(
          page.getByRole('option', { name: 'Open settings', selected: true })
        ).toBeVisible();
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await expect(
          page.getByRole('option', { name: 'Create task', selected: true })
        ).toBeVisible();
      },
    },
    {
      id: 'enter-runs',
      title: 'Enter runs the selected item',
      async run({ page }) {
        await search(page).fill('task');
        await page.keyboard.press('Enter');
        await expect.poll(() => eventNames(page)).toContain('select');
      },
    },
  ])
);
