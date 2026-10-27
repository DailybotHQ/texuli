import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { eventNames, expectFocus } from './common.ts';

const slider = (page: Page, name: string) => page.getByRole('slider', { name, exact: true });
const currentValue = async (page: Page, name: string) =>
  Number(await slider(page, name).getAttribute('aria-valuenow'));

/** A point on a slider's track, as a fraction of its length from the left edge. */
async function trackPoint(page: Page, track: string, fraction: number) {
  const box = await page.locator(`[data-behavior-track="${track}"]`).boundingBox();
  if (!box) throw new Error(`track ${track} is not visible`);
  return { x: box.x + box.width * fraction, y: box.y + box.height / 2 };
}

scenario(
  'slider',
  defineRows([
    {
      id: 'roles',
      title: 'each thumb is a named slider with its value and bounds',
      async run({ page }) {
        await expect(slider(page, 'Volume')).toHaveAttribute('aria-valuenow', '40');
        await expect(slider(page, 'Volume')).toHaveAttribute('aria-valuemin', '0');
        await expect(slider(page, 'Volume')).toHaveAttribute('aria-valuemax', '100');
        await expect(slider(page, 'Volume')).toHaveAttribute('aria-orientation', 'horizontal');
        await expect(slider(page, 'Minimum price')).toHaveAttribute('aria-valuenow', '200');
        await expect(slider(page, 'Maximum price')).toHaveAttribute('aria-valuenow', '800');
      },
    },
    {
      id: 'keyboard',
      title: 'arrows step, Home and End jump to the ends',
      async run({ page }) {
        await slider(page, 'Volume').focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => currentValue(page, 'Volume')).toBe(45);
        await page.keyboard.press('ArrowUp');
        await expect.poll(() => currentValue(page, 'Volume')).toBe(50);
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => currentValue(page, 'Volume')).toBe(40);
        await page.keyboard.press('End');
        await expect.poll(() => currentValue(page, 'Volume')).toBe(100);
        await page.keyboard.press('Home');
        await expect.poll(() => currentValue(page, 'Volume')).toBe(0);
      },
    },
    {
      id: 'tab-order',
      title: 'every enabled thumb is in the Tab order',
      async run({ page }) {
        await slider(page, 'Volume').focus();
        await page.keyboard.press('Tab');
        await expectFocus(page, 'slider', 'Minimum price');
        await page.keyboard.press('Tab');
        await expectFocus(page, 'slider', 'Maximum price');
      },
    },
    {
      id: 'range-order',
      title: 'the two thumbs of a range stay in order',
      async run({ page }) {
        await slider(page, 'Minimum price').focus();
        await page.keyboard.press('End');
        await expect
          .poll(
            async () =>
              (await currentValue(page, 'Minimum price')) <=
              (await currentValue(page, 'Maximum price'))
          )
          .toBe(true);
        await slider(page, 'Maximum price').focus();
        await page.keyboard.press('Home');
        await expect
          .poll(
            async () =>
              (await currentValue(page, 'Minimum price')) <=
              (await currentValue(page, 'Maximum price'))
          )
          .toBe(true);
      },
    },
    {
      id: 'rtl',
      title: 'in RTL, ArrowLeft increases and the left end is the maximum',
      async run({ page }) {
        await slider(page, 'Balance').focus();
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => currentValue(page, 'Balance')).toBe(51);
        const point = await trackPoint(page, 'balance', 0.1);
        await page.mouse.click(point.x, point.y);
        await expect.poll(() => currentValue(page, 'Balance')).toBeGreaterThanOrEqual(85);
      },
    },
    {
      id: 'pointer-click',
      title: 'a click on the track moves the nearest thumb there and focuses it',
      async run({ page }) {
        const point = await trackPoint(page, 'volume', 0.75);
        await page.mouse.click(point.x, point.y);
        await expect.poll(() => currentValue(page, 'Volume')).toBe(75);
        await expectFocus(page, 'slider', 'Volume');
      },
    },
    {
      id: 'pointer-drag',
      title: 'dragging a thumb follows the pointer and commits once on release',
      async run({ page }) {
        const thumb = await slider(page, 'Volume').boundingBox();
        if (!thumb) throw new Error('thumb is not visible');
        await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
        await page.mouse.down();
        const target = await trackPoint(page, 'volume', 0.25);
        await page.mouse.move(target.x, target.y, { steps: 5 });
        await expect.poll(() => currentValue(page, 'Volume')).toBe(25);
        await page.mouse.up();
        await expect
          .poll(async () => (await eventNames(page)).filter((name) => name === 'commit').length)
          .toBe(1);
      },
    },
    {
      id: 'touch',
      title: 'a tap on a touch screen moves the thumb',
      projects: ['mobile'],
      async run({ page }) {
        const point = await trackPoint(page, 'volume', 0.6);
        await page.touchscreen.tap(point.x, point.y);
        await expect.poll(() => currentValue(page, 'Volume')).toBe(60);
      },
    },
    {
      id: 'disabled',
      title: 'a disabled slider ignores keys and the pointer',
      async run({ page }) {
        await expect(slider(page, 'Locked')).toHaveAttribute('aria-disabled', 'true');
        await slider(page, 'Locked').focus();
        await page.keyboard.press('ArrowRight');
        const point = await trackPoint(page, 'locked', 0.9);
        await page.mouse.click(point.x, point.y);
        await expect.poll(() => currentValue(page, 'Locked')).toBe(30);
      },
    },
    {
      id: 'axe',
      title: 'axe finds no violations',
      async run({ page }) {
        const results = await new AxeBuilder({ page }).include('[data-behavior-track]').analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
      },
    },
  ])
);
