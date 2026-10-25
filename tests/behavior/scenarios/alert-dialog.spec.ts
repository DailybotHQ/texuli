import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusSequence, frame, isInert, pointerOutside } from '../harness/oracle.ts';
import { eventNames, expectFocus, layerClosed, sampleOpenToFocus } from './common.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Delete project' });
const alert = (page: import('@playwright/test').Page) =>
  page.getByRole('alertdialog', { name: 'Delete project?' });
async function open(page: import('@playwright/test').Page) {
  await trigger(page).click();
  await expect(alert(page)).toBeVisible();
}

scenario(
  'alert-dialog',
  defineRows([
    {
      id: 'alertdialog-named',
      title: 'it is an alertdialog named by its title and described',
      async run({ page, recordOpenToFocus }) {
        await open(page);
        await expect(alert(page)).toHaveAccessibleDescription(
          'The fictional Orbit project and its tasks will be removed.'
        );
        await page.keyboard.press('Escape');
        await layerClosed(page);
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'focus-starts-on-cancel',
      title: 'focus starts on Cancel, the safe choice',
      async run({ page }) {
        await open(page);
        await expectFocus(page, 'button', 'Cancel');
      },
    },
    {
      id: 'focus-trapped',
      title: 'Tab stays on Cancel and Delete',
      async run({ page }) {
        await open(page);
        for (const stop of await focusSequence(page, 5))
          expect(['Cancel', 'Delete']).toContain(stop.name);
      },
    },
    {
      id: 'outside-pointer-keeps-open',
      title: 'a pointer press outside does not dismiss it',
      async run({ page }) {
        await open(page);
        await pointerOutside(page);
        await page.waitForTimeout(150);
        await expect(alert(page)).toBeVisible();
      },
    },
    {
      id: 'cancel-closes-without-confirming',
      title: 'Cancel closes it without confirming',
      async run({ page }) {
        await open(page);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await layerClosed(page);
        expect(await eventNames(page)).not.toContain('confirm');
      },
    },
    {
      id: 'action-confirms',
      title: 'Delete confirms once and closes it',
      async run({ page }) {
        await open(page);
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await layerClosed(page);
        expect((await eventNames(page)).filter((name) => name === 'confirm')).toHaveLength(1);
      },
    },
    {
      id: 'escape-returns-focus',
      title: 'Escape closes it and focus returns to the trigger',
      async run({ page }) {
        await open(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Delete project');
      },
    },
    {
      id: 'outside-inert',
      title: 'the page behind it is inert',
      async run({ page }) {
        await open(page);
        expect(await isInert(frame.before(page))).toBe(true);
      },
    },
  ])
);
