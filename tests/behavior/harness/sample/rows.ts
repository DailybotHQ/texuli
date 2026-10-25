/**
 * The sample scenario: a modal dialog, written the way every scenario under
 * `tests/behavior/scenarios/` is. Rows read only what a user or assistive
 * technology observes.
 */
import { expect } from '@playwright/test';
import { defineRows } from '../index.ts';
import {
  behaviorEvents,
  focusedElement,
  focusIsWithin,
  focusSequence,
  frame,
  isInert,
  isScrollLocked,
  openToFocus,
  pointerOutside,
} from '../oracle.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Open settings' });
const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog');

async function open(page: import('@playwright/test').Page) {
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
}

export const sampleRows = defineRows([
  {
    id: 'trigger-named',
    title: 'the trigger is a button named by its text',
    async run({ page }) {
      await expect(trigger(page)).toBeVisible();
    },
  },
  {
    id: 'dialog-named',
    title: 'the open dialog is named by its title and described',
    async run({ page }) {
      await open(page);
      await expect(dialog(page)).toHaveAccessibleName('Settings');
      await expect(dialog(page)).toHaveAccessibleDescription(
        'Change how your fictional workspace looks.'
      );
    },
  },
  {
    id: 'focus-moves-in',
    title: 'opening moves focus into the dialog',
    async run({ page, recordOpenToFocus }) {
      await open(page);
      expect(await focusIsWithin(dialog(page))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      recordOpenToFocus(
        await openToFocus({
          trigger: trigger(page),
          within: '[role="dialog"], dialog',
          close: async () => {
            await page.keyboard.press('Escape');
            await expect(dialog(page)).toHaveCount(0);
          },
        })
      );
    },
  },
  {
    id: 'focus-trapped',
    title: 'Tab and Shift+Tab stay inside the dialog',
    async run({ page }) {
      await open(page);
      const forward = await focusSequence(page, 6);
      const backward = await focusSequence(page, 6, { reverse: true });
      for (const stop of [...forward, ...backward]) {
        expect(['textbox', 'button']).toContain(stop.role);
        expect(['Display name', 'Save', 'Close']).toContain(stop.name);
      }
      expect(await focusIsWithin(dialog(page))).toBe(true);
    },
  },
  {
    id: 'escape-returns-focus',
    title: 'Escape closes it and focus returns to the trigger',
    async run({ page }) {
      await open(page);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect
        .poll(() => focusedElement(page))
        .toEqual({ role: 'button', name: 'Open settings' });
    },
  },
  {
    id: 'outside-inert',
    title: 'the page behind the dialog is inert while it is open',
    async run({ page }) {
      await open(page);
      expect(await isInert(frame.before(page))).toBe(true);
      expect(await isInert(frame.after(page))).toBe(true);
    },
  },
  {
    id: 'scroll-locked',
    title: 'the page does not scroll while the dialog is open',
    async run({ page }) {
      expect(await isScrollLocked(page)).toBe(false);
      await open(page);
      expect(await isScrollLocked(page)).toBe(true);
    },
  },
  {
    id: 'scroll-released',
    title: 'the page scrolls again once the dialog closes',
    async run({ page }) {
      await open(page);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect.poll(() => isScrollLocked(page)).toBe(false);
    },
  },
  {
    id: 'outside-pointer-closes',
    title: 'a pointer press outside closes it',
    async run({ page }) {
      await open(page);
      await pointerOutside(page);
      await expect(dialog(page)).toHaveCount(0);
    },
  },
  {
    id: 'open-change-events',
    title: 'it reports opening and closing once each, in order',
    async run({ page }) {
      await open(page);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect
        .poll(() => behaviorEvents(page))
        .toEqual([
          { name: 'openChange', detail: true },
          { name: 'openChange', detail: false },
        ]);
    },
  },
]);
