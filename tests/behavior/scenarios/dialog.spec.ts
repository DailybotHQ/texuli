import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import {
  focusIsWithin,
  focusSequence,
  frame,
  isInert,
  isScrollLocked,
  pointerOutside,
} from '../harness/oracle.ts';
import {
  expectEvents,
  expectFocus,
  gotoScenarioWith,
  layer,
  layerClosed,
  sampleOpenToFocus,
} from './common.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Open settings' });
const dialog = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: 'Settings' });
async function open(page: import('@playwright/test').Page) {
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
}

scenario(
  'dialog',
  defineRows([
    {
      id: 'contained-backdrop-under-content',
      title:
        'contained: the backdrop fills only the container, stays out of the top layer, and the content is on top',
      async run({ page }) {
        await gotoScenarioWith(page, 'dialog', { variant: 'contained' });
        await page.getByRole('button', { name: 'Open panel dialog' }).click();
        const panel = page.getByRole('dialog', { name: 'Panel dialog' });
        await expect(panel).toBeVisible();
        const note = panel.getByRole('textbox', { name: 'Note' });
        await expect(note).toBeFocused();
        // The content's input is what a pointer at its center hits (not the backdrop).
        const box = await note.boundingBox();
        if (!box) throw new Error('note has no box');
        const hit = await page.evaluate(
          ([x, y]) =>
            (document.elementFromPoint(x as number, y as number) as HTMLInputElement | null)?.name,
          [box.x + box.width / 2, box.y + box.height / 2]
        );
        expect(hit).toBe('note');
        // The backdrop covers the container, not the viewport, and is not a top-layer popover.
        // It fills the container's padding box (inside its border), not the viewport.
        const container = await page.locator('[data-behavior-container]').evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.x + node.clientLeft,
            y: rect.y + node.clientTop,
            width: node.clientWidth,
            height: node.clientHeight,
          };
        });
        const backdrop = page.locator('.behavior-contained-overlay');
        const backdropBox = await backdrop.boundingBox();
        if (!backdropBox) throw new Error('missing backdrop box');
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(backdropBox[key] - container[key]), key).toBeLessThan(1.5);
        }
        expect(await backdrop.evaluate((node) => node.matches(':popover-open'))).toBe(false);
        await note.fill('Harbor');
        await expect(note).toHaveValue('Harbor');
      },
    },
    {
      id: 'mounted-open-keeps-focus',
      title: 'a dialog mounted already open has focus on its first field, and typing reaches it',
      async run({ page }) {
        await gotoScenarioWith(page, 'dialog', { variant: 'mounted-open' });
        const palette = page.getByRole('dialog', { name: 'Command palette' });
        await expect(palette).toBeVisible();
        const search = palette.getByRole('textbox', { name: 'Search commands' });
        await expect(search).toBeFocused();
        await page.keyboard.type('open');
        await expect(search).toHaveValue('open');
      },
    },
    {
      id: 'trigger-named',
      title: 'the trigger is a button that says it opens a dialog',
      async run({ page }) {
        await expect(trigger(page)).toHaveAttribute('aria-haspopup', 'dialog');
        await expect(
          page.getByRole('button', { name: 'Open settings', expanded: false })
        ).toBeVisible();
      },
    },
    {
      id: 'dialog-named',
      title: 'the dialog is named by its title and described by its description',
      async run({ page }) {
        await open(page);
        await expect(dialog(page)).toHaveAccessibleDescription(
          'Change how your fictional workspace looks.'
        );
        await expect(
          page.getByRole('button', { name: 'Open settings', expanded: true })
        ).toBeAttached();
      },
    },
    {
      id: 'focus-moves-in',
      title: 'opening moves focus into the dialog',
      async run({ page, recordOpenToFocus }) {
        await open(page);
        expect(await focusIsWithin(dialog(page))).toBe(true);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        recordOpenToFocus(await sampleOpenToFocus(page, trigger(page)));
      },
    },
    {
      id: 'focus-trapped',
      title: 'Tab and Shift+Tab stay inside the dialog',
      async run({ page }) {
        await open(page);
        const stops = [
          ...(await focusSequence(page, 6)),
          ...(await focusSequence(page, 6, { reverse: true })),
        ];
        for (const stop of stops) {
          expect(['Display name', 'Open details', 'Close'], JSON.stringify(stops)).toContain(
            stop.name
          );
        }
      },
    },
    {
      id: 'escape-returns-focus',
      title: 'Escape closes it and focus returns to the trigger',
      async run({ page }) {
        await open(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'button', 'Open settings');
      },
    },
    {
      id: 'close-button',
      title: 'the Close button closes it',
      async run({ page }) {
        await open(page);
        const close = layer(page).getByRole('button', { name: 'Close' });
        await close.click();
        await layerClosed(page);
      },
    },
    {
      id: 'escape-closes-top-layer-only',
      title: 'with a nested dialog open, Escape closes only the top one',
      async run({ page }) {
        await open(page);
        await page.getByRole('button', { name: 'Open details' }).click();
        await expect(page.getByRole('dialog', { name: 'Details' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Details' })).toHaveCount(0);
        await expect(dialog(page)).toBeVisible();
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
        await layerClosed(page);
        await expect.poll(() => isScrollLocked(page)).toBe(false);
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
      id: 'open-change-events',
      title: 'it reports opening and closing once each, in order',
      async run({ page }) {
        await open(page);
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectEvents(page, [
          { name: 'openChange', detail: true },
          { name: 'openChange', detail: false },
        ]);
      },
    },
  ])
);
