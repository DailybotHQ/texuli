import { expect } from '@playwright/test';
import { defineRows, focusedElement, scenario } from '../harness/index.ts';

function notifications(page: import('@playwright/test').Page) {
  return page.getByRole('region', { name: 'Notifications' });
}

/**
 * Toast region rows. Observable behavior only (roles, focus, F6).
 */
scenario(
  'toast',
  defineRows([
    {
      id: 'region-labelled',
      title: 'it exposes a labelled notifications region',
      async run({ page }) {
        await expect(notifications(page)).toBeVisible();
      },
    },
    {
      id: 'publish-shows-toast',
      title: 'publishing shows title and description',
      async run({ page }) {
        await page.getByRole('button', { name: 'Publish toast' }).click();
        await expect(notifications(page).getByText('File saved', { exact: true })).toBeVisible();
        await expect(
          notifications(page).getByText('Undo is available.', { exact: true })
        ).toBeVisible();
      },
    },
    {
      id: 'action-dismisses',
      title: 'the Undo action dismisses the toast',
      async run({ page }) {
        await page.getByRole('button', { name: 'Publish toast' }).click();
        await expect(notifications(page).getByText('File saved', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect(notifications(page).getByText('File saved', { exact: true })).toHaveCount(0);
      },
    },
    {
      id: 'f6-focuses-action',
      title: 'F6 moves focus to a toast action',
      async run({ page }) {
        await page.getByRole('button', { name: 'Publish toast' }).click();
        await page.keyboard.press('F6');
        await expect
          .poll(() => focusedElement(page))
          .toEqual({
            role: 'button',
            name: 'Undo',
          });
      },
    },
    {
      id: 'contained-positions-container',
      title:
        'a contained region positions a static container after mount, and leaves a declared one alone',
      async run({ page }) {
        const staticFrame = page.getByTestId('static-frame');
        const positionedFrame = page.getByTestId('positioned-frame');
        await expect(staticFrame.getByTestId('static-region')).toHaveCount(1);
        await expect(positionedFrame.getByTestId('positioned-region')).toHaveCount(1);
        await expect
          .poll(() => staticFrame.evaluate((node) => (node as HTMLElement).style.position))
          .toBe('relative');
        await expect(
          positionedFrame.evaluate((node) => (node as HTMLElement).style.position)
        ).resolves.toBe('absolute');
      },
    },
  ])
);
