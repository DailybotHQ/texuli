import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * FIX-calendar-host-parity: what host apps used to polyfill around
 * CalendarView, now in the view itself. The data-calendar example uses a
 * fixed clock (2026-04-15 13:50 UTC, 6:50 AM in its default Pacific zone),
 * creates an event from an empty slot or a date, and writes moves back.
 */

const ID = 'data-calendar';
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];

async function open(page: Page, mode: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: mode });
  await page.goto(`/?fixture=${ID}&mode=${mode}`);
  await expect(page.locator(`[data-example="${ID}"]`)).toBeVisible({ timeout: 30_000 });
  await expect(chip(page, 'design-review')).toBeVisible();
}

const chip = (page: Page, key: string) => page.locator(`[data-calendar-event="${key}"]`);
const selected = (page: Page) => page.locator('.selected');
const slot = (page: Page) => page.locator('[data-slot][data-focused]');

test.describe('data calendar · host parity', () => {
  test('creates a timed event from the focused empty slot with the keyboard', async ({ page }) => {
    await open(page);
    await expect(slot(page)).toHaveAttribute(
      'aria-label',
      /^Empty slot, Wednesday, April 15, 2026, 9:00\sAM\. Enter adds an event$/
    );
    await slot(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(slot(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(selected(page)).toHaveText('Created New event 1 (2026-04-15T16:15:00.000Z).');
    await expect(
      page.getByRole('button', { name: /^New event 1, Wednesday, April 15, 2026, 9:15/ })
    ).toBeVisible();
  });

  test('creates from a click on an empty part of a day and all-day from a date', async ({
    page,
  }) => {
    await open(page);
    const column = page.locator('[data-day-column="2026-04-16"]');
    const box = await column.boundingBox();
    if (!box) throw new Error('no day column');
    // 7:00 AM Pacific, inside the scroller's first screen.
    await column.click({ position: { x: 8, y: (box.height / 24) * 7 + 2 } });
    await expect(selected(page)).toHaveText('Created New event 1 (2026-04-16T14:00:00.000Z).');
    await page.locator('[data-calendar-date="2026-04-17"]').click();
    await expect(selected(page)).toHaveText('Created New event 2 (2026-04-17).');
    await expect(
      page.getByRole('button', { name: /^New event 2, All day, Friday, April 17, 2026/ })
    ).toBeVisible();
  });

  test('draws the now line from the injected clock and follows Today', async ({ page }) => {
    await open(page);
    const line = page.locator('[data-now-line]');
    await expect(line).toHaveCount(1);
    await expect(page.locator('[data-day-column="2026-04-15"] [data-now-line]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Next period' }).click();
    await expect(line).toHaveCount(0);
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(line).toHaveCount(1);
  });

  test('picks an event up with Space, moves it with arrows and drops it with Enter', async ({
    page,
  }) => {
    await open(page);
    const event = chip(page, 'design-review');
    await event.focus();
    await page.keyboard.press('Space');
    await expect(event).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-calendar-announcer]')).toContainText(
      'Design review: Thursday, April 16, 2026'
    );
    await expect(event).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(selected(page)).toHaveText('Moved Design review to 2026-04-16T13:15:00.000Z.');
    await expect(event).toBeFocused();
    await expect(event).not.toHaveAttribute('aria-pressed', 'true');
    // Escape puts a grabbed event back.
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-calendar-announcer]')).toHaveText('Move cancelled.');
    await expect(
      page.locator('[data-day-column="2026-04-16"] [data-calendar-event="design-review"]')
    ).toBeVisible();
  });

  test('titles the week without a year and names all-day events "Title, All day"', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('[data-calendar] h2')).toHaveText('Apr 12 – Apr 18');
    await expect(chip(page, 'team-lunch')).toHaveAttribute(
      'aria-label',
      /^Team lunch, All day, Wednesday, April 15, 2026,/
    );
  });

  test('opens the time grid just above the now line, already scrolled and unfocused', async ({
    page,
  }) => {
    // Reduced motion: the grid must still open in place, with no smooth scroll.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Record the scroll position in the first animation frame (before the
    // first paint) after the grid is inserted: no later jump means no shift.
    await page.addInitScript(() => {
      const record = window as unknown as { firstScroll?: number };
      new MutationObserver((_, observer) => {
        const grid = document.querySelector('[data-time-scroller]');
        if (!grid) return;
        observer.disconnect();
        requestAnimationFrame(() => {
          record.firstScroll = grid.scrollTop;
        });
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`/?fixture=${ID}&mode=light`);
    const scroller = page.locator(`[data-example="${ID}"] [data-time-scroller]`);
    await scroller.waitFor();
    await page.waitForFunction(() => 'firstScroll' in window);
    const first = await page.evaluate(
      () => (window as unknown as { firstScroll: number }).firstScroll
    );
    // 6:50 AM Pacific: it opens at 5:50, an hour above the line.
    await expect(scroller).toHaveAttribute('data-open-minute', String(5 * 60 + 50));
    const expected = await scroller.evaluate(
      (element) => ((element.firstElementChild as HTMLElement).offsetHeight / 1440) * (5 * 60 + 50)
    );
    expect(Math.abs(first - expected)).toBeLessThan(2);
    await expect(page.locator('[data-now-line]')).toBeInViewport();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    // Moving through weeks keeps the user's scroll position.
    await scroller.evaluate((element) => element.scrollTo({ top: 100, behavior: 'instant' }));
    await page.getByRole('button', { name: 'Next period' }).click();
    await expect(page.locator('[data-now-line]')).toHaveCount(0);
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(100);
  });

  test('opens at 8 AM when today is out of range', async ({ page }) => {
    await open(page);
    // The month view unmounts the time grid, so the week view opens fresh in May.
    const modes = page.getByRole('group', { name: 'Calendar view' });
    await modes.getByRole('button', { name: 'Month' }).click();
    await page.getByRole('button', { name: 'Next period' }).click();
    await modes.getByRole('button', { name: 'Week' }).click();
    const scroller = page.locator(`[data-example="${ID}"] [data-time-scroller]`);
    await expect(scroller).toHaveAttribute('data-open-minute', String(8 * 60));
    await expect(page.locator('[data-now-line]')).toHaveCount(0);
    const offset = await scroller.evaluate(
      (element) =>
        element.scrollTop - ((element.firstElementChild as HTMLElement).offsetHeight / 1440) * 480
    );
    expect(Math.abs(offset)).toBeLessThan(2);
  });

  test(`passes axe with the slot focused and an event grabbed in light and dark`, async ({
    page,
  }) => {
    for (const mode of ['light', 'dark'] as const) {
      await open(page, mode);
      await slot(page).focus();
      await chip(page, 'design-review').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
      await expect(chip(page, 'design-review')).toHaveAttribute('aria-pressed', 'true');
      const results = await new AxeBuilder({ page })
        .include(`[data-example="${ID}"]`)
        .withTags(AXE_TAGS)
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
