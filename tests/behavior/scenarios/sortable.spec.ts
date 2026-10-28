import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { eventNames, expectFocus } from './common.ts';

const list = (page: Page, name: string) => page.getByRole('list', { name, exact: true });
const handle = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const names = (page: Page, name: string) =>
  list(page, name)
    .getByRole('listitem')
    .evaluateAll((items) => items.map((item) => item.querySelector('span')?.textContent ?? ''));
const center = async (page: Page, name: string) => {
  const box = await handle(page, name).boundingBox();
  if (!box) throw new Error(`no box for ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const politeText = (page: Page) => page.locator('[aria-live="polite"]').first().textContent();

scenario(
  'sortable',
  defineRows([
    {
      id: 'handles-named-and-described',
      title: 'handles are named buttons with a role description and keyboard instructions',
      async run({ page }) {
        const button = handle(page, 'Plan launch');
        await expect(button).toHaveAttribute('aria-roledescription', 'draggable item');
        await expect(button).toHaveAccessibleDescription(/Space or Enter to pick up/);
        await expect(page.locator('[aria-grabbed]')).toHaveCount(0);
        const box = await button.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(24);
        expect(box?.height).toBeGreaterThanOrEqual(24);
      },
    },
    {
      id: 'keyboard-reorder',
      title: 'Space picks up, arrows move, Space drops, focus stays and the move is announced',
      async run({ page }) {
        await handle(page, 'Plan launch').focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await expect
          .poll(() => names(page, 'To do'))
          .toEqual(['Draft notes', 'Review copy', 'Plan launch']);
        await expectFocus(page, 'button', 'Plan launch');
        await expect.poll(() => politeText(page)).toMatch(/Plan launch dropped at position 3 of 3/);
        expect(await eventNames(page)).toEqual(['move']);
      },
    },
    {
      id: 'escape-restores',
      title: 'Escape cancels a keyboard move, restores the order and keeps focus',
      async run({ page }) {
        await handle(page, 'Draft notes').focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await expect
          .poll(() => names(page, 'To do'))
          .toEqual(['Draft notes', 'Plan launch', 'Review copy']);
        await page.keyboard.press('Escape');
        await expect
          .poll(() => names(page, 'To do'))
          .toEqual(['Plan launch', 'Draft notes', 'Review copy']);
        await expectFocus(page, 'button', 'Draft notes');
        expect(await eventNames(page)).toEqual([]);
      },
    },
    {
      id: 'keyboard-cross-list',
      title: 'moving past the end of a list continues into the next list',
      async run({ page }) {
        await handle(page, 'Review copy').focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await expect.poll(() => names(page, 'Done')).toEqual(['Review copy', 'Ship release']);
      },
    },
    {
      id: 'pointer-reorder',
      title: 'a pointer drag on a handle reorders the list',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        const from = await center(page, 'Plan launch');
        const to = await center(page, 'Review copy');
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y + 10, { steps: 3 });
        await page.mouse.move(to.x, to.y + 12, { steps: 8 });
        await page.mouse.up();
        await expect
          .poll(() => names(page, 'To do'))
          .toEqual(['Draft notes', 'Review copy', 'Plan launch']);
      },
    },
    {
      id: 'pointer-cross-list',
      title: 'a pointer drag moves an item into another list',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        const from = await center(page, 'Draft notes');
        const to = await center(page, 'Ship release');
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y + 10, { steps: 3 });
        await page.mouse.move(to.x, to.y + 12, { steps: 10 });
        await page.mouse.up();
        await expect.poll(() => names(page, 'Done')).toEqual(['Ship release', 'Draft notes']);
        await expect.poll(() => names(page, 'To do')).toEqual(['Plan launch', 'Review copy']);
      },
    },
    {
      id: 'pointer-escape',
      title: 'Escape during a pointer drag cancels it',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        const from = await center(page, 'Plan launch');
        const to = await center(page, 'Review copy');
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y + 12, { steps: 8 });
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect
          .poll(() => names(page, 'To do'))
          .toEqual(['Plan launch', 'Draft notes', 'Review copy']);
        expect(await eventNames(page)).toEqual([]);
      },
    },
    {
      id: 'touch-drag',
      title: 'a touch drag on a handle reorders the list on a phone',
      projects: ['mobile'],
      async run({ page }) {
        const from = await center(page, 'Plan launch');
        const to = await center(page, 'Review copy');
        const target = handle(page, 'Plan launch');
        const touch = {
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          bubbles: true,
        };
        await target.dispatchEvent('pointerdown', { ...touch, clientX: from.x, clientY: from.y });
        for (let step = 1; step <= 8; step += 1) {
          const y = from.y + ((to.y + 12 - from.y) * step) / 8;
          await page.evaluate(
            ([x, y, init]) =>
              document.dispatchEvent(
                new PointerEvent('pointermove', { ...init, clientX: x, clientY: y })
              ),
            [from.x, y, touch] as const
          );
        }
        await page.evaluate(
          ([x, y, init]) =>
            document.dispatchEvent(
              new PointerEvent('pointerup', { ...init, clientX: x, clientY: y })
            ),
          [to.x, to.y + 12, touch] as const
        );
        await expect
          .poll(() => names(page, 'To do'))
          .toEqual(['Draft notes', 'Review copy', 'Plan launch']);
      },
    },
    {
      id: 'axe-clean',
      title: 'the scenario has no axe violations',
      async run({ page }) {
        const result = await new AxeBuilder({ page })
          .include('[aria-label="Sortable examples"]')
          .analyze();
        expect(result.violations).toEqual([]);
      },
    },
  ])
);
