import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { behaviorEvents, gotoScenario } from '../harness/oracle.ts';

/*
 * Sheet, Drawer, Panel and ResponsiveModal, held to the WAI-ARIA APG dialog
 * pattern: modal sheets,
 * the non-modal panel, drawer snap points and swipe to dismiss by mouse and
 * by touch, the responsive modal, and axe.
 */

const open = (page: Page) => gotoScenario(page, 'sheet');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name });
const events = async (page: Page) => (await behaviorEvents(page)).map((event) => event.name);
const insideFocus = (page: Page, name: string) =>
  dialog(page, name).evaluate((node) => node.contains(document.activeElement));

/** Drag the drawer's grip by `distance` px down (mouse on desktop, CDP touch on the phone). */
async function dragGrip(page: Page, distance: number, touch: boolean) {
  const box = await page.locator('[data-drawer-handle]').boundingBox();
  if (!box) throw new Error('No drawer handle');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (!touch) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) await page.mouse.move(x, y + (distance * step) / 8);
    // Hold still before releasing, so the release has no fling.
    await page.mouse.move(x, y + distance);
    await page.waitForTimeout(120);
    await page.mouse.move(x, y + distance);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, dy: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: y + dy }],
    });
  await send('touchStart', 0);
  for (let step = 1; step <= 8; step += 1) await send('touchMove', (distance * step) / 8);
  await page.waitForTimeout(120);
  await send('touchMove', distance);
  await send('touchEnd', distance);
}

test.describe('sheet, drawer and panel (APG dialog)', () => {
  test('a sheet is a modal dialog on its side that traps and restores focus', async ({ page }) => {
    await open(page);
    const trigger = button(page, 'Open filters');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const sheet = dialog(page, 'Filters');
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet).toHaveAttribute('data-side', 'left');
    await expect.poll(() => insideFocus(page, 'Filters')).toBe(true);
    for (let press = 0; press < 4; press += 1) {
      await page.keyboard.press('Tab');
      expect(await insideFocus(page, 'Filters')).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('a sheet closes on a backdrop press', async ({ page }) => {
    await open(page);
    await button(page, 'Open filters').click();
    const sheet = dialog(page, 'Filters');
    await expect(sheet).toBeVisible();
    const viewport = page.viewportSize() ?? { width: 800, height: 600 };
    await page.mouse.click(viewport.width - 8, viewport.height / 2);
    await expect(sheet).toBeHidden();
    expect(await events(page)).toEqual(['sheet', 'sheet']);
  });

  test('logical start opens on the right in RTL', async ({ page }) => {
    await open(page);
    await page.locator('.actions').evaluate((node) => node.setAttribute('dir', 'rtl'));
    await button(page, 'Open filters').click();
    const sheet = dialog(page, 'Filters');
    await expect(sheet).toHaveAttribute('data-side', 'right');
    await expect(sheet).toHaveCSS('right', '0px');
    expect(
      Number.parseFloat(await sheet.evaluate((node) => getComputedStyle(node).left))
    ).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('a panel takes focus but leaves the page usable', async ({ page }) => {
    await open(page);
    const trigger = button(page, 'Show details');
    await trigger.click();
    const panel = dialog(page, 'Order details');
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute('aria-modal', /.*/);
    await expect(button(page, 'Copy id')).toBeFocused();
    await button(page, 'Page action').click();
    await expect(panel).toBeVisible();
    expect(await events(page)).toContain('page');
    await button(page, 'Copy id').focus();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('a dismissOutside panel closes on an outside press and outside focus, not on its trigger', async ({
    page,
    isMobile,
  }) => {
    await open(page);
    const trigger = button(page, 'Show notes');
    const notes = dialog(page, 'Order notes');
    await trigger.click();
    await expect(notes).toBeVisible();
    // Pressing the trigger is not outside (releasing it toggles, as a trigger
    // does). On a phone the open panel covers its trigger, so this step runs on
    // desktop only; the unit test covers the trigger branch everywhere.
    if (!isMobile) {
      await trigger.hover();
      await page.mouse.down();
      await expect(notes).toBeVisible();
      await page.mouse.up();
      await expect(notes).toBeHidden();
    } else {
      await button(page, 'Page action').click();
      await expect(notes).toBeHidden();
    }
    await trigger.click();
    await expect(notes).toBeVisible();
    await button(page, 'Page action').click();
    await expect(notes).toBeHidden();
    await trigger.click();
    await expect(notes).toBeVisible();
    await button(page, 'Page action').focus();
    await expect(notes).toBeHidden();
  });

  test('closeOnEscape closes a panel on Escape anywhere; the default panel ignores Escape outside', async ({
    page,
  }) => {
    await open(page);
    await button(page, 'Show details').click();
    await expect(dialog(page, 'Order details')).toBeVisible();
    await button(page, 'Page action').click();
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'Order details')).toBeVisible();
    await button(page, 'Close details').click();
    await expect(dialog(page, 'Order details')).toBeHidden();

    await button(page, 'Show log').click();
    const log = dialog(page, 'Order log');
    await expect(log).toBeVisible();
    await button(page, 'Page action').click();
    await expect(log).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(log).toBeHidden();
  });

  test('a drawer steps through its snap points from the keyboard', async ({ page }) => {
    await open(page);
    await button(page, 'Open cart').focus();
    await page.keyboard.press('Enter');
    const drawer = dialog(page, 'Cart');
    await expect(drawer).toHaveAttribute('data-snap-point', '0.5');
    await expect(drawer).toHaveAttribute('data-side', 'bottom');
    const handle = button(page, 'Resize cart');
    await handle.focus();
    await page.keyboard.press('Enter');
    await expect(drawer).toHaveAttribute('data-snap-point', '1');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('a drawer drags between snap points and swipes away', async ({ page }, testInfo) => {
    const touch = testInfo.project.name === 'mobile';
    await open(page);
    await button(page, 'Open cart').click();
    const drawer = dialog(page, 'Cart');
    await expect(drawer).toHaveAttribute('data-snap-point', '0.5');
    const height = (await drawer.boundingBox())?.height ?? 400;
    // Up by a third of the drawer: settles fully open.
    await dragGrip(page, -height / 3, touch);
    await expect(drawer).toHaveAttribute('data-snap-point', '1');
    // A short pull springs back.
    await dragGrip(page, height * 0.1, touch);
    await expect(drawer).toHaveAttribute('data-snap-point', '1');
    await expect(drawer).toBeVisible();
    // Down past the last snap point: dismissed.
    await dragGrip(page, height * 0.9, touch);
    await expect(drawer).toBeHidden();
    expect(await events(page)).toEqual(['drawer', 'drawer']);
  });

  test('the responsive modal is a dialog on desktop and a drawer on the phone', async ({
    page,
  }, testInfo) => {
    await open(page);
    await button(page, 'Share').click();
    const modal = dialog(page, 'Share order');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    const phone = testInfo.project.name === 'mobile';
    await expect(modal).toHaveAttribute('data-side', phone ? 'bottom' : 'center');
    await button(page, 'Done').click();
    await expect(modal).toBeHidden();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      const scan = async () =>
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
        ).violations.map((violation) => violation.id);
      expect(await scan()).toEqual([]);
      for (const [trigger, name] of [
        ['Open filters', 'Filters'],
        ['Open cart', 'Cart'],
        ['Show details', 'Order details'],
      ] as const) {
        await button(page, trigger).click();
        await expect(dialog(page, name)).toBeVisible();
        expect(await scan()).toEqual([]);
        // Focus is inside each one (the panel takes it too), so Escape closes it.
        await page.keyboard.press('Escape');
        await expect(dialog(page, name)).toBeHidden();
      }
    });
  }
});
