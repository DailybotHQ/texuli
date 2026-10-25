import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { gotoScenario, isInert } from '../harness/oracle.ts';

/*
 * Splitter (resizable panels), held to the WAI-ARIA APG window splitter
 * pattern: keyboard, pointer and
 * touch resizing, collapse, persistence, right to left, and axe.
 */

const open = (page: Page) => gotoScenario(page, 'splitter');
const handle = (page: Page, name: string) => page.getByRole('separator', { name });
const nav = (page: Page) => handle(page, 'Resize navigation');
const width = (locator: Locator) => locator.evaluate((node) => node.getBoundingClientRect().width);
const value = (locator: Locator) => locator.getAttribute('aria-valuenow');

test.describe('splitter (APG window splitter)', () => {
  test('exposes a named, focusable separator with its value range', async ({ page }) => {
    await open(page);
    await expect(nav(page)).toHaveAttribute('aria-orientation', 'vertical');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '30');
    await expect(nav(page)).toHaveAttribute('aria-valuemin', '0');
    await expect(nav(page)).toHaveAttribute('aria-valuemax', '60');
    await expect(nav(page)).toHaveAttribute('aria-controls', 'nav-pane');
    await expect(handle(page, 'Resize terminal')).toHaveAttribute('aria-orientation', 'horizontal');
    await page.getByRole('link', { name: 'Inbox' }).focus();
    await page.keyboard.press('Tab');
    await expect(nav(page)).toBeFocused();
  });

  test('resizes with the keyboard: arrows, Home and End', async ({ page }) => {
    await open(page);
    const pane = page.locator('#nav-pane');
    const before = await width(pane);
    await nav(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '40');
    expect(await width(pane)).toBeGreaterThan(before);
    await page.keyboard.press('End');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '60');
    await page.keyboard.press('Home');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '20');
    const terminal = handle(page, 'Resize terminal');
    await terminal.focus();
    await page.keyboard.press('ArrowDown');
    await expect(terminal).toHaveAttribute('aria-valuenow', '70');
  });

  test('Enter collapses the pane (its content goes inert) and restores it', async ({ page }) => {
    await open(page);
    await nav(page).focus();
    await page.keyboard.press('Enter');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#nav-pane')).toHaveAttribute('data-state', 'collapsed');
    expect(await width(page.locator('#nav-pane'))).toBe(0);
    expect(await isInert(page.getByRole('link', { name: 'Inbox', includeHidden: true }))).toBe(
      true
    );
    await page.keyboard.press('Enter');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '30');
    await expect(page.locator('#nav-pane')).toHaveAttribute('data-state', 'expanded');
  });

  test('mirrors the arrows in right to left', async ({ page }) => {
    await open(page);
    const rtl = handle(page, 'تغيير حجم القائمة');
    await rtl.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(rtl).toHaveAttribute('aria-valuenow', '40');
    // The first pane is on the right, and it grew leftwards.
    const side = await page.locator('#rtl-side').boundingBox();
    const main = await page.locator('#rtl-main').boundingBox();
    expect(side && main && side.x > main.x).toBe(true);
  });

  test('drags with a mouse', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'The phone drags by touch (next test).');
    await open(page);
    const group = await page.getByTestId('mail').boundingBox();
    const box = await nav(page).boundingBox();
    if (!group || !box) throw new Error('no layout');
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + group.width * 0.15, y, { steps: 5 });
    await expect(nav(page)).toHaveAttribute('data-state', 'active');
    await page.mouse.up();
    await expect(nav(page)).toHaveAttribute('data-state', 'inactive');
    expect(Number(await value(nav(page)))).toBeGreaterThanOrEqual(44);
    expect(Number(await value(nav(page)))).toBeLessThanOrEqual(46);
  });

  test('drags with touch', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile',
      'A real touch drag needs the Chromium phone (CDP touch).'
    );
    await open(page);
    const group = await page.getByTestId('mail').boundingBox();
    const box = await nav(page).boundingBox();
    if (!group || !box) throw new Error('no layout');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, px: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }],
      });
    await touch('touchStart', x);
    for (let step = 1; step <= 5; step += 1)
      await touch('touchMove', x + (group.width * 0.15 * step) / 5);
    await touch('touchEnd', x);
    await expect.poll(async () => Number(await value(nav(page)))).toBeGreaterThanOrEqual(44);
    expect(Number(await value(nav(page)))).toBeLessThanOrEqual(46);
  });

  test('keeps the layout across a reload (persistence hook)', async ({ page }) => {
    await open(page);
    await nav(page).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '50');
    await page.reload();
    await expect(page.locator('html[data-behavior-ready="true"]')).toHaveCount(1);
    await expect(nav(page)).toHaveAttribute('aria-valuenow', '50');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await nav(page).focus();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});
