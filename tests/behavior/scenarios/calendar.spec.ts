import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { behaviorEvents, defineRows, scenario } from '../harness/index.ts';

const grid = (page: import('@playwright/test').Page) => page.getByRole('grid');
const day = (page: import('@playwright/test').Page, number: number) =>
  grid(page).getByRole('button', { name: new RegExp(`July ${number}, 2024`) });

scenario(
  'calendar',
  defineRows([
    {
      id: 'apg-grid',
      title: 'the calendar exposes a named grid with localized weekday headers and one tab stop',
      async run({ page }) {
        await expect(grid(page)).toHaveAttribute('aria-label', 'July 2024');
        await expect(grid(page).getByRole('columnheader')).toHaveCount(7);
        await expect(grid(page).getByRole('gridcell', { selected: true })).toContainText('15');
        await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1);
      },
    },
    {
      id: 'keyboard-navigation',
      title: 'arrows, Home, End and Page keys navigate the calendar grid',
      async run({ page }) {
        await day(page, 15).focus();
        await page.keyboard.press('ArrowRight');
        await expect(day(page, 16)).toBeFocused();
        await page.keyboard.press('ArrowUp');
        await expect(day(page, 9)).toBeFocused();
        await page.keyboard.press('End');
        await expect(day(page, 13)).toBeFocused();
        await page.keyboard.press('PageDown');
        await expect(grid(page)).toHaveAttribute('aria-label', 'August 2024');
        await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1);
      },
    },
    {
      id: 'pointer-selection',
      title: 'a pointer selects an available day and reports its date value',
      async run({ page }) {
        await day(page, 17).click();
        expect(await behaviorEvents(page)).toContainEqual({
          name: 'valueChange',
          detail: '2024-07-17',
        });
        await expect(grid(page).getByRole('gridcell', { selected: true })).toContainText('17');
      },
    },
    {
      id: 'touch-selection',
      title: 'a touch tap selects an available day',
      async run({ page }) {
        if (!test.info().project.use.hasTouch) return;
        const box = await day(page, 18).boundingBox();
        if (!box) throw new Error('calendar day is not visible');
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await expect(grid(page).getByRole('gridcell', { selected: true })).toContainText('18');
      },
    },
    {
      id: 'bounds-and-unavailable',
      title: 'minimum, maximum and unavailable dates cannot be selected',
      async run({ page }) {
        await expect(day(page, 4)).toBeDisabled();
        await expect(day(page, 20)).toBeDisabled();
        await expect(grid(page).getByRole('gridcell', { selected: true })).toContainText('15');
        await page.getByRole('button', { name: 'Next month' }).click();
        await expect(grid(page)).toHaveAttribute('aria-label', 'August 2024');
        await expect(grid(page).getByRole('button', { name: /August 21, 2024/ })).toBeDisabled();
      },
    },
    {
      id: 'rtl',
      title: 'RTL reverses horizontal grid navigation',
      async run({ page }) {
        const root = page.locator('[data-behavior-scenario="calendar"] [data-calendar-behavior]');
        await root.evaluate((element) => element.setAttribute('dir', 'rtl'));
        await day(page, 15).focus();
        await page.keyboard.press('ArrowLeft');
        await expect(day(page, 16)).toBeFocused();
      },
    },
    {
      id: 'axe',
      title: 'axe finds no calendar accessibility violations',
      async run({ page }) {
        const result = await new AxeBuilder({ page }).include('[data-calendar-behavior]').analyze();
        expect(result.violations.map((violation) => violation.id)).toEqual([]);
      },
    },
  ])
);
