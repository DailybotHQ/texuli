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
      id: 'trigger-state',
      title: 'the trigger reports collapsed, then expanded',
      async run({ page }) {
        await expect(page.getByRole('button', { name: 'Filters', expanded: false })).toBeVisible();
        await open(page);
        await expect(page.getByRole('button', { name: 'Filters', expanded: true })).toBeVisible();
      },
    },
    {
      id: 'focus-moves-in',
      title: 'opening moves focus into the panel',
      async run({ page, recordOpenToFocus }) {
        await open(page);
        expect(await focusIsWithin(layer(page))).toBe(true);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'escape-returns-focus',
      title: 'Escape closes it and focus returns to the trigger',
      async run({ page }) {
        await open(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Filters');
      },
    },
    {
      id: 'outside-pointer-closes',
      title: 'a pointer press outside closes it',
      async run({ page }) {
        await open(page);
        await pointerOutside(page);
        await layerClosed(page);
      },
    },
    {
      id: 'focus-can-leave',
      title: 'it is not modal: focus can move to the page behind it',
      async run({ page }) {
        await open(page);
        expect(await isInert(frame.after(page))).toBe(false);
      },
    },
    {
      id: 'anchored-below',
      title: 'it opens below its trigger, 6 px away',
      async run({ page }) {
        await open(page);
        const anchor = await trigger(page).boundingBox();
        const panel = await layer(page).boundingBox();
        expect(anchor && panel).toBeTruthy();
        if (anchor && panel) expect(Math.round(panel.y - (anchor.y + anchor.height))).toBe(6);
      },
    },
    {
      id: 'close-button',
      title: 'the Apply button closes it',
      async run({ page }) {
        await open(page);
        await layer(page).getByRole('button', { name: 'Apply' }).click();
        await layerClosed(page);
        await expectEvents(page, [
          { name: 'openChange', detail: true },
          { name: 'openChange', detail: false },
        ]);
      },
    },
    {
      id: 'modal-traps-tab',
      title: 'a modal popover keeps Tab and Shift+Tab inside it',
      async run({ page }) {
        await page.getByRole('button', { name: 'Share' }).click();
        await expect(layer(page)).toBeVisible();
        await expect.poll(() => focusIsWithin(layer(page))).toBe(true);
        for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
          await page.keyboard.press(key);
          expect(await focusIsWithin(layer(page))).toBe(true);
        }
      },
    },
    {
      id: 'modal-escape-returns-focus',
      title: 'Escape closes a modal popover and focus returns to its trigger',
      async run({ page }) {
        await page.getByRole('button', { name: 'Share' }).click();
        await expect(layer(page)).toBeVisible();
        await expect.poll(() => focusIsWithin(layer(page))).toBe(true);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Share');
      },
    },
  ])
);
