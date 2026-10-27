import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusIsWithin, frame, isInert, pointerOutside } from '../harness/oracle.ts';
import { expectEvents, expectFocus, layer, layerClosed, sampleOpenToFocus } from './common.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Filters' });
async function open(page: import('@playwright/test').Page) {
  await trigger(page).click();
  await expect(layer(page)).toBeVisible();
}

scenario(
  'popover',
  defineRows([
    {
      id: 'open-anchored-not-modal',
      title:
        'opening: the trigger reports collapsed then expanded, focus moves in, the panel sits 6 px below its trigger, and the page behind stays usable (not modal)',
      async run({ page }) {
        await expect(page.getByRole('button', { name: 'Filters', expanded: false })).toBeVisible();
        await open(page);
        await expect(page.getByRole('button', { name: 'Filters', expanded: true })).toBeVisible();
        expect(await focusIsWithin(layer(page))).toBe(true);
        const anchor = await trigger(page).boundingBox();
        const panel = await layer(page).boundingBox();
        expect(anchor && panel).toBeTruthy();
        if (anchor && panel) expect(Math.round(panel.y - (anchor.y + anchor.height))).toBe(6);
        expect(await isInert(frame.after(page))).toBe(false);
      },
    },
    {
      id: 'escape-returns-focus',
      title: 'Escape closes it and focus returns to the trigger',
      async run({ page, recordOpenToFocus }) {
        await open(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Filters');
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'apply-and-outside-pointer-close',
      title:
        'the Apply button closes it (opening and closing reported once each), and so does a pointer press outside',
      async run({ page }) {
        await open(page);
        await layer(page).getByRole('button', { name: 'Apply' }).click();
        await layerClosed(page);
        await expectEvents(page, [
          { name: 'openChange', detail: true },
          { name: 'openChange', detail: false },
        ]);
        await open(page);
        await pointerOutside(page);
        await layerClosed(page);
      },
    },
    {
      id: 'modal-traps-and-returns-focus',
      title:
        'a modal popover keeps Tab and Shift+Tab inside it; Escape closes it and focus returns to its trigger',
      async run({ page }) {
        await page.getByRole('button', { name: 'Share' }).click();
        await expect(layer(page)).toBeVisible();
        await expect.poll(() => focusIsWithin(layer(page))).toBe(true);
        for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
          await page.keyboard.press(key);
          expect(await focusIsWithin(layer(page))).toBe(true);
        }
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Share');
      },
    },
  ])
);
