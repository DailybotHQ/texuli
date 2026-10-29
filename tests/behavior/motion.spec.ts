import { expect, type Page, test } from '@playwright/test';

/*
 * Motion on the shared runtime (ADR-013, texuli/motion over
 * @texuli/core/motion), in real browsers: an overlay (Dialog) enters and
 * exits through Web Animations, stays mounted and inert only while its exit
 * runs, and gives focus back at close; a list (Board) glides its cards to
 * their new place after a move. Nothing plays on the first render, and
 * reduced motion is instant.
 */

/**
 * Slow the theme's motion tokens (under `scope`) so a check reads an
 * animation mid-way; the runtime clamps durations at 1 s.
 */
async function slowMotion(page: Page, scope = ':root'): Promise<void> {
  await page.addStyleTag({
    content: `${scope} { --tx-motion-fast: 900ms; --tx-motion-base: 900ms; --tx-motion-slow: 900ms; }`,
  });
}

const running = (page: Page, selector: string) =>
  page.evaluate(
    (css) =>
      document
        .querySelector(css)
        ?.getAnimations()
        .filter((animation) => animation.playState === 'running').length ?? -1,
    selector
  );

test.describe('motion on the shared runtime', () => {
  test('a dialog exits and enters through Web Animations; focus returns at close', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?fixture=ui-dialog&mode=light');
    const dialog = page.locator('[data-tx-dialog]');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    // Open on the first render: it paints its end state, nothing plays.
    expect(await running(page, '[data-tx-dialog]')).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await slowMotion(page);
    const trigger = page.getByRole('button', { name: 'Open settings' });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Workspace settings' })).toBeVisible();
    expect(await running(page, '[data-tx-dialog]'), 'enter').toBeGreaterThan(0);
    // Let the enter end before closing.
    await page.waitForFunction(
      () => (document.querySelector('[data-tx-dialog]')?.getAnimations().length ?? 1) === 0
    );

    await page.keyboard.press('Escape');
    const exiting = await page.evaluate(() => {
      const node = document.querySelector('[data-tx-dialog]');
      return {
        mounted: node !== null,
        state: node?.getAttribute('data-state'),
        inert: node?.hasAttribute('inert'),
        animating: (node?.getAnimations().length ?? 0) > 0,
        focus: document.activeElement?.textContent?.trim(),
      };
    });
    // Held for its exit, out of reach, while focus is already back on the trigger.
    expect(exiting).toEqual({
      mounted: true,
      state: 'closed',
      inert: true,
      animating: true,
      focus: 'Open settings',
    });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('a dialog is instant under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?fixture=ui-dialog&mode=light');
    await expect(page.locator('[data-tx-dialog]')).toBeVisible({ timeout: 20_000 });
    await slowMotion(page);
    const after = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const node = document.querySelector('[data-tx-dialog]');
      return { animations: node?.getAnimations().length ?? 0 };
    });
    expect(after.animations).toBe(0);
    await expect(page.locator('[data-tx-dialog]')).toHaveCount(0, { timeout: 1_000 });
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.locator('[data-tx-dialog]')).toBeVisible();
    expect(await running(page, '[data-tx-dialog]')).toBe(0);
  });

  for (const reduced of [false, true]) {
    test(`a board card glides to its new column${reduced ? ' (instant when reduced)' : ''}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.goto('/?fixture=data-board&mode=light', { waitUntil: 'networkidle' });
      const board = page.locator('[data-example="data-board"] .tx-board').first();
      await expect(board).toBeVisible({ timeout: 20_000 });
      // Slow the board only (the move menu keeps its own speed).
      await slowMotion(page, '.tx-board');
      expect(await running(page, '[data-item-id="task-1"]')).toBe(0);
      const trigger = board.locator('[data-item-id="task-1"] [data-board-move-menu]');
      // An open menu, not one still playing its exit (that one is inert).
      const menuItem = page
        .locator('[role="menu"]:not([inert])')
        .getByRole('menuitem', { name: 'Done — top' });
      await trigger.click();
      // The move menu is a lazy chunk: the first press may only load it.
      await expect(page.locator('[data-board-move-menu-chunk]').first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(async () => {
        if (
          !(await menuItem.isVisible()) &&
          (await trigger.getAttribute('aria-expanded')) !== 'true'
        ) {
          await trigger.click();
        }
        await expect(menuItem).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await menuItem.click();
      await expect(board.locator('[data-board-cell][aria-label="Done"]')).toContainText(
        'Map the core flow'
      );
      const moved = await board
        .locator('[data-item-id="task-1"]')
        .evaluate((card) => card.getAnimations().filter((a) => a.playState === 'running').length);
      if (reduced) expect(moved).toBe(0);
      else expect(moved).toBeGreaterThan(0);
    });
  }
});
