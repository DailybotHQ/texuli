import { expect, test } from '@playwright/test';

/*
 * T-gaps-80-85 browser checks beside tests/e2e/print-isolation.spec.ts (G80).
 *
 * The `data-board-footer` example puts its board in a section that is a grid
 * item of the demo. A grid item's automatic minimum width is its content's
 * min-content width (the board's columns), so on a phone the section, and
 * the page, grew to the board's full width (784 px on a 412 px viewport)
 * even though the board scrolls sideways itself (G76). The example's grid
 * items now take `min-inline-size: 0`.
 */
for (const width of [390, 412]) {
  test(`the data-board-footer example does not widen a ${width} px page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?fixture=data-board-footer');
    await expect(
      page.locator('[data-example="data-board-footer"] [data-board-scroller]')
    ).toBeVisible({
      timeout: 30_000,
    });
    const widths = await page.evaluate(() => ({
      scroll: (document.scrollingElement ?? document.documentElement).scrollWidth,
      viewport: window.innerWidth,
      board: document.querySelector('[data-board-scroller]')?.scrollWidth ?? 0,
      boardBox: document.querySelector('[data-board-scroller]')?.clientWidth ?? 0,
    }));
    // The board scrolls sideways inside its box; the page does not.
    expect(widths.board).toBeGreaterThan(widths.boardBox);
    expect(widths.boardBox).toBeLessThanOrEqual(widths.viewport);
    expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
  });
}
