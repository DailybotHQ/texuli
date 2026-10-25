import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { gotoScenario } from '../harness/oracle.ts';
import { eventNames, expectFocus } from './common.ts';

/*
 * ContextMenu, held to the WAI-ARIA APG menu pattern:
 * right click at the pointer, the keyboard (Shift+F10), the shared Menu
 * keys and submenus, dismissal, a touch long press on the phone, and axe.
 */

const open = (page: Page) => gotoScenario(page, 'context-menu');
const canvas = (page: Page) => page.locator('[data-context-menu-trigger]');
const menus = (page: Page) => page.getByRole('menu');
const item = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });

async function rightClickAt(page: Page, dx: number, dy: number) {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('No canvas');
  const point = { x: box.x + dx, y: box.y + dy };
  await page.mouse.click(point.x, point.y, { button: 'right' });
  return point;
}

test.describe('context menu (APG menu at the pointer)', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'The phone opens it by long press (below).');
  });

  test('a right click opens it at the pointer with focus on the menu', async ({ page }) => {
    await open(page);
    const point = await rightClickAt(page, 60, 40);
    const menu = menus(page);
    await expect(menu).toBeVisible();
    await expect(canvas(page)).toHaveAttribute('data-state', 'open');
    await expect(menu).toBeFocused();
    const box = await menu.boundingBox();
    expect(Math.abs((box?.x ?? 0) - point.x)).toBeLessThan(8);
    expect(Math.abs((box?.y ?? 0) - point.y)).toBeLessThan(8);
    await page.keyboard.press('ArrowDown');
    await expectFocus(page, 'menuitem', 'Cut');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    expect(await eventNames(page)).toEqual(['openChange', 'select', 'openChange']);
  });

  test('a second right click moves it; a left click or an outside press closes it', async ({
    page,
  }) => {
    await open(page);
    await rightClickAt(page, 20, 20);
    const first = await menus(page).boundingBox();
    // Far right of the canvas, outside the open menu: it moves there (flipped
    // or shifted to stay in view, so it spans the pointer's column).
    const width = (await canvas(page).boundingBox())?.width ?? 300;
    const point = await rightClickAt(page, width - 20, 20);
    await expect
      .poll(async () => Math.abs(((await menus(page).boundingBox())?.x ?? 0) - (first?.x ?? 0)))
      .toBeGreaterThan(50);
    const moved = await menus(page).boundingBox();
    expect(moved && moved.x <= point.x && point.x <= moved.x + moved.width + 8).toBe(true);
    await expect(menus(page)).toBeFocused();
    await canvas(page).click({ position: { x: 10, y: 10 } });
    await expect(menus(page)).toBeHidden();
    await rightClickAt(page, 20, 20);
    await expect(menus(page)).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(menus(page)).toBeHidden();
  });

  test('the Menu key opens it on the first item; Escape returns focus', async ({
    page,
  }, testInfo) => {
    await open(page);
    const shape = page.getByRole('button', { name: 'Selected shape' });
    await shape.focus();
    // Chromium turns the Menu key into the native contextmenu event; headless
    // WebKit does not, so there send the event the browser would.
    if (testInfo.project.name === 'chromium') await page.keyboard.press('ContextMenu');
    else await shape.dispatchEvent('contextmenu', { bubbles: true, cancelable: true });
    await expectFocus(page, 'menuitem', 'Cut');
    await page.keyboard.press('End');
    await expectFocus(page, 'menuitem', 'Share');
    await page.keyboard.press('ArrowRight');
    await expectFocus(page, 'menuitem', 'Copy link');
    await page.keyboard.press('ArrowLeft');
    await expectFocus(page, 'menuitem', 'Share');
    await page.keyboard.press('Escape');
    await expect(menus(page)).toBeHidden();
    await expect(shape).toBeFocused();
  });

  test('the pointer runs items, checkboxes and submenus', async ({ page }) => {
    await open(page);
    await rightClickAt(page, 30, 30);
    const snap = page.getByRole('menuitemcheckbox', { name: 'Snap to grid' });
    await expect(snap).toHaveAttribute('aria-checked', 'true');
    await snap.click();
    await expect(menus(page)).toBeHidden();
    await rightClickAt(page, 30, 30);
    await expect(snap).toHaveAttribute('aria-checked', 'false');
    await item(page, 'Share').hover();
    await item(page, 'Copy link').click();
    await expect(menus(page)).toHaveCount(0);
    expect(await eventNames(page)).toContain('select');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe with the menu open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await rightClickAt(page, 30, 30);
      await expect(menus(page)).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});

test.describe('context menu by touch', () => {
  test('a long press opens it; a tap runs an item', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'A real touch needs the Chromium phone (CDP).');
    await open(page);
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error('No canvas');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: box.x + 40, y: box.y + 30 }],
      });
    // A quick tap does nothing.
    await touch('touchStart');
    await touch('touchEnd');
    await page.waitForTimeout(800);
    await expect(menus(page)).toHaveCount(0);
    // Holding still opens it, and lifting the finger keeps it open.
    await touch('touchStart');
    await page.waitForTimeout(800);
    await expect(menus(page)).toBeVisible();
    await touch('touchEnd');
    await expect(menus(page)).toBeVisible();
    await item(page, 'Copy').tap();
    await expect(menus(page)).toHaveCount(0);
    expect(await eventNames(page)).toEqual(['openChange', 'select', 'openChange']);
  });

  test('passes axe on the phone with the menu open', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Desktop axe runs above.');
    await open(page);
    await canvas(page).click({ button: 'right', position: { x: 30, y: 30 } });
    await expect(menus(page)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
