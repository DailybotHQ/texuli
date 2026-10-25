import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusSequence } from '../harness/oracle.ts';

const toasts = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Notifications' });

scenario(
  'portal',
  defineRows([
    {
      id: 'renders-outside',
      title: 'portaled content renders outside the component, at the end of the page',
      async run({ page }) {
        await expect(toasts(page)).toBeVisible();
        expect(
          await toasts(page).evaluate((node) => !node.closest('[data-behavior="scenario"]'))
        ).toBe(true);
      },
    },
    {
      id: 'reactive-target',
      title: 'changing the target moves the content there',
      async run({ page }) {
        await page.getByRole('button', { name: 'Move toasts to the device frame' }).click();
        await expect(
          page
            .getByRole('region', { name: 'Device frame' })
            .getByRole('region', { name: 'Notifications' })
        ).toBeVisible();
        await expect(toasts(page).getByRole('button', { name: 'Undo' })).toBeVisible();
      },
    },
    {
      id: 'toast-reachable-under-modal',
      title: 'the toast region stays keyboard-reachable while a modal is open (R16)',
      async run({ page }) {
        await page.getByRole('button', { name: 'Open editor' }).click();
        await expect(page.getByRole('dialog', { name: 'Editor' })).toBeVisible();
        const stops = await focusSequence(page, 8);
        expect(stops.map((stop) => stop.name)).toContain('Undo');
      },
    },
  ])
);
