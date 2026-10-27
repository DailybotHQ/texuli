import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusedElement } from '../harness/oracle.ts';
import { eventNames, expectFocus, layer, layerClosed, sampleOpenToFocus } from './common.ts';

const dueTrigger = (page: Page) => page.getByRole('button', { name: 'Choose due date' });
const stayTrigger = (page: Page) => page.getByRole('button', { name: 'Choose stay dates' });
const dueGrid = (page: Page) => layer(page).getByRole('grid');
const due = (page: Page) => page.locator('[data-behavior-due]');
const stay = (page: Page) => page.locator('[data-behavior-stay]');
const day = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function openDue(page: Page) {
  await dueTrigger(page).click();
  await expect(layer(page)).toBeVisible();
  await expectFocus(page, 'button', 'Sunday, March 15, 2026');
}

/** Days from an ISO date string, for checking a range relative to today. */
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

scenario(
  'date-picker',
  defineRows([
    {
      id: 'open-named-dialog-grid-escape',
      title:
        'the calendar button is collapsed, then expanded; opening focuses the selected date in a grid named by its month, in a dialog named for choosing the date; PageDown moves a month; Escape closes without choosing and returns focus',
      async run({ page, recordOpenToFocus }) {
        await expect(
          page.getByRole('button', { name: 'Choose due date', expanded: false })
        ).toBeVisible();
        await openDue(page);
        await expect(
          page.getByRole('button', { name: 'Choose due date', expanded: true })
        ).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Due date calendar' })).toBeVisible();
        await expect(dueGrid(page)).toHaveAccessibleName('March 2026');
        await expect(
          dueGrid(page).getByRole('gridcell', { name: 'Sunday, March 15, 2026' })
        ).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('PageDown');
        await expectFocus(page, 'button', 'Wednesday, April 15, 2026');
        await expect(dueGrid(page)).toHaveAccessibleName('April 2026');
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expect(due(page)).toHaveText('2026-03-15');
        await expectFocus(page, 'button', 'Choose due date');
        // Timed in the page, from the click to the first focus inside the calendar.
        recordOpenToFocus(await sampleOpenToFocus(page, dueTrigger(page)));
      },
    },
    {
      id: 'keyboard-choose-and-outside',
      title:
        'a pointer press outside closes the calendar without choosing; arrows move by day and Enter chooses: the dialog closes, the field updates, focus returns',
      async run({ page }) {
        await openDue(page);
        await page.mouse.click(4, 4);
        await layerClosed(page);
        await expect(due(page)).toHaveText('2026-03-15');
        await openDue(page);
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'button', 'Monday, March 16, 2026');
        await page.keyboard.press('ArrowDown');
        await expectFocus(page, 'button', 'Monday, March 23, 2026');
        await page.keyboard.press('Enter');
        await layerClosed(page);
        await expect(due(page)).toHaveText('2026-03-23');
        expect(await eventNames(page)).toContain('valueChange');
        await expectFocus(page, 'button', 'Choose due date');
      },
    },
    {
      id: 'pointer-choose',
      title: 'a click or tap on a day chooses it',
      async run({ page }) {
        // The Pixel 7 project emulates touch: tap there, click elsewhere.
        const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
        if (touch) {
          await dueTrigger(page).tap();
          await expect(layer(page)).toBeVisible();
          await day(page, 'Friday, March 20, 2026').tap();
        } else {
          await openDue(page);
          await day(page, 'Friday, March 20, 2026').click();
        }
        await layerClosed(page);
        await expect(due(page)).toHaveText('2026-03-20');
      },
    },
    {
      id: 'field-drives-calendar',
      title: 'changing the day in the field moves the calendar selection',
      async run({ page }) {
        const daySegment = page
          .getByRole('group', { name: 'Due date' })
          .getByRole('spinbutton', { name: /day/i });
        await daySegment.focus();
        await page.keyboard.press('ArrowUp');
        await expect(due(page)).toHaveText('2026-03-16');
        await dueTrigger(page).click();
        await expectFocus(page, 'button', 'Monday, March 16, 2026');
      },
    },
    {
      id: 'range-keyboard',
      title:
        'a range: Enter picks the start, arrows and Enter the end; the days between are selected',
      async run({ page }) {
        await stayTrigger(page).click();
        const range = page.locator('[data-behavior-range-layer]');
        await expect(range).toBeVisible();
        await expect.poll(async () => (await focusedElement(page)).role).toBe('button');
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await expect(range).toHaveCount(0);
        const [start = '', end = ''] = ((await stay(page).textContent()) ?? '').split('/');
        expect(dayNumber(end) - dayNumber(start)).toBe(2);
        await stayTrigger(page).click();
        await expect(
          page.locator('[data-behavior-range-layer]').getByRole('gridcell', { selected: true })
        ).toHaveCount(3);
      },
    },
    {
      id: 'axe-open',
      title: 'the open date picker has no axe violations',
      async run({ page }) {
        await openDue(page);
        const result = await new AxeBuilder({ page }).include('.behavior-date-picker').analyze();
        expect(result.violations.map((violation) => violation.id)).toEqual([]);
      },
    },
  ])
);
