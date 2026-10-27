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
      id: 'open-named-cancel-trapped-inert',
      title:
        'opening: an alertdialog named and described, focus on Cancel (the safe choice), Tab stays on Cancel and Delete, the page behind is inert',
      async run({ page }) {
        await open(page);
        await expect(alert(page)).toHaveAccessibleDescription(
          'The fictional Orbit project and its tasks will be removed.'
        );
        await expectFocus(page, 'button', 'Cancel');
        for (const stop of await focusSequence(page, 5))
          expect(['Cancel', 'Delete']).toContain(stop.name);
        expect(await isInert(frame.before(page))).toBe(true);
      },
    },
    {
      id: 'outside-keeps-escape-returns-focus',
      title:
        'a pointer press outside does not dismiss it; Escape closes it and focus returns to the trigger',
      async run({ page, recordOpenToFocus }) {
        await open(page);
        await pointerOutside(page);
        await page.waitForTimeout(150);
        await expect(alert(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Delete project');
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'cancel-and-action',
      title: 'Cancel closes it without confirming; Delete confirms once and closes it',
      async run({ page }) {
        await open(page);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await layerClosed(page);
        expect(await eventNames(page)).not.toContain('confirm');
        await open(page);
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await layerClosed(page);
        expect((await eventNames(page)).filter((name) => name === 'confirm')).toHaveLength(1);
      },
    },
  ])
);
