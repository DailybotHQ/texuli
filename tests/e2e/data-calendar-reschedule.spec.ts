import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

/*
 * FIX-calendar-reschedule: in a real browser, an event moves by pointer drag
 * (whole day columns across, snapped slots down; mirrored in RTL) and by
 * Control+Arrow keys with a live announcement and focus kept on the event.
 * The data-calendar example writes each change back into its events.
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
const column = (page: Page, date: string) => page.locator(`[data-day-column="${date}"]`);

async function dragBy(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('event chip has no box');
  const x = box.x + Math.min(12, box.width / 2);
  const y = box.y + Math.min(8, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

test.describe('data calendar · reschedule', () => {
  test('drags an event one day later and one hour down', async ({ page }) => {
    await open(page);
    const day = await column(page, '2026-04-15').boundingBox();
    if (!day) throw new Error('no day column');
    await dragBy(page, chip(page, 'design-review'), day.width, day.height / 24);
    await expect(page.locator('.selected')).toHaveText(
      'Moved Design review to 2026-04-16T14:00:00.000Z.'
    );
    await expect(
      column(page, '2026-04-16').locator('[data-calendar-event="design-review"]')
    ).toBeVisible();
    await expect(page.locator('[data-calendar-announcer]')).toContainText(
      'Design review moved to Thursday, April 16, 2026'
    );
  });

  test('mirrors the drag direction in RTL', async ({ page }) => {
    await open(page);
    await page.getByLabel('Calendar direction').selectOption('rtl');
    const day = await column(page, '2026-04-15').boundingBox();
    if (!day) throw new Error('no day column');
    // Dragging toward the inline end (left in RTL) is one day later.
    await dragBy(page, chip(page, 'design-review'), -day.width, 0);
    await expect(page.locator('.selected')).toHaveText(
      'Moved Design review to 2026-04-16T13:00:00.000Z.'
    );
  });

  test('moves a focused event with Control+Arrow keys and keeps focus on it', async ({ page }) => {
    await open(page);
    const event = chip(page, 'research-sync');
    await event.focus();
    await page.keyboard.press('Control+ArrowRight');
    await expect(page.locator('[data-calendar-announcer]')).toContainText(
      'Research sync moved to Thursday, April 16, 2026'
    );
    await expect(event).toBeFocused();
    await page.keyboard.press('Control+ArrowDown');
    await expect(page.locator('.selected')).toHaveText(
      'Moved Research sync to 2026-04-16T13:45:00.000Z.'
    );
    await expect(event).toBeFocused();
    // Enter still opens it.
    await page.keyboard.press('Enter');
    await expect(page.locator('.selected')).toContainText(
      'Research sync (2026-04-16T13:45:00.000Z)'
    );
  });

  test('keeps a repeating occurrence apart and respects the allowed dates', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Month' }).click();
    await expect(page.locator('[data-month-grid]')).toBeVisible();
    const lunch = chip(page, 'team-lunch');
    await lunch.focus();
    // April 15 + 3 weeks is May 6: outside max (April 30).
    await page.keyboard.press('Control+ArrowDown');
    await page.keyboard.press('Control+ArrowDown');
    await expect(page.locator('.selected')).toHaveText('Moved Team lunch to 2026-04-29.');
    await page.keyboard.press('Control+ArrowDown');
    await expect(page.locator('[data-calendar-announcer]')).toHaveText(
      "Team lunch can't move outside the allowed dates."
    );
    const weekly = page.locator('[data-calendar-event^="weekly-planning|"]').first();
    const key = await weekly.getAttribute('data-calendar-event');
    await weekly.focus();
    await page.keyboard.press('Control+ArrowRight');
    await expect(page.locator(`[data-calendar-event="${key}"]`)).toBeFocused();
    await expect(page.locator('[data-calendar-event^="weekly-planning|"]')).toHaveCount(4);
  });

  test('moves with Alt+Arrow and never navigates back', async ({ page }) => {
    await page.goto('about:blank');
    await open(page);
    const url = page.url();
    const event = chip(page, 'design-review');
    await event.focus();
    // Alt+Left is the browser's Back shortcut on Windows and Linux: the calendar takes it.
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('.selected')).toHaveText(
      'Moved Design review to 2026-04-14T13:00:00.000Z.'
    );
    expect(page.url()).toBe(url);
    await expect(event).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.locator('.selected')).toHaveText(
      'Moved Design review to 2026-04-14T12:45:00.000Z.'
    );
    await expect(event).toHaveAttribute('aria-keyshortcuts', /Alt\+ArrowLeft.*Shift\+F10/);
  });

  test('moves through the Move menu with the keyboard (Shift+F10)', async ({ page }) => {
    await open(page);
    const event = chip(page, 'research-sync');
    await event.focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu', { name: 'Move Research sync to…' });
    await expect(menu).toBeVisible();
    // Focus starts on the first destination: 15 minutes earlier, 15 later, 1 hour earlier, 1 hour later, previous day, next day.
    await expect(page.getByRole('menuitem', { name: '15 minutes earlier' })).toBeFocused();
    for (let step = 0; step < 5; step += 1) await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Next day' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(page.locator('.selected')).toHaveText(
      'Moved Research sync to 2026-04-16T13:30:00.000Z.'
    );
    await expect(page.locator('[data-calendar-announcer]')).toContainText(
      'Research sync moved to Thursday, April 16, 2026'
    );
    await expect(event).toBeFocused();
  });

  test('opens the Move menu with a right click and disables dates outside April', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Month' }).click();
    const lunch = chip(page, 'team-lunch');
    await lunch.click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Move Team lunch to…' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // Two weeks later is April 29; a third week would leave April.
    for (let week = 0; week < 2; week += 1) {
      await lunch.focus();
      await page.keyboard.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'Next week' }).click();
      await expect(menu).toBeHidden();
    }
    await expect(page.locator('.selected')).toHaveText('Moved Team lunch to 2026-04-29.');
    await lunch.focus();
    await page.keyboard.press('Shift+F10');
    await expect(
      page.getByRole('menuitem', { name: 'Next week, outside the allowed dates' })
    ).toHaveAttribute('aria-disabled', 'true');
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`passes axe after a move and with the Move menu open (${mode})`, async ({ page }) => {
      await open(page, mode);
      await chip(page, 'design-review').focus();
      await page.keyboard.press('Control+ArrowRight');
      await expect(page.locator('[data-calendar-announcer]')).not.toBeEmpty();
      await page.keyboard.press('Shift+F10');
      await expect(page.getByRole('menu', { name: 'Move Design review to…' })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include(`[data-example="${ID}"]`)
        .include('[data-calendar-move-menu]')
        .withTags(AXE_TAGS)
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
