import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * FIX-grid-edit-virtual: 100,000 editable rows render only the rows in view
 * (plus overscan and the active row), stay editable, and keyboard navigation
 * reaches every row.
 */

const ID = 'data-grid-editing-virtual';
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
  await expect(grid(page)).toBeVisible();
}

const grid = (page: Page) => page.getByRole('grid', { name: 'Fictional ledgers' });
const bodyRows = (page: Page) => grid(page).locator('tbody tr[aria-rowindex]');
const row = (page: Page, index: number) => grid(page).locator(`tr[aria-rowindex="${index}"]`);
const cell = (page: Page, index: number, col: number) =>
  row(page, index).locator(`[aria-colindex="${col}"]`);
/** The demo passes rowSize={41}, so row n starts n * 41 px down the body. */
const area = (page: Page) => page.locator(`[data-example="${ID}"] [data-tx-table-wrap]`);

test.describe('data grid editing · 100,000 rows', () => {
  test('renders a bounded window and keeps it bounded while scrolling', async ({ page }) => {
    await open(page);
    await expect(grid(page)).toHaveAttribute('aria-rowcount', '100001');
    expect(await bodyRows(page).count()).toBeLessThanOrEqual(30);
    await area(page).evaluate((element) => {
      element.scrollTop = 41 * 50_000;
    });
    await expect(row(page, 50_002)).toBeVisible();
    expect(await bodyRows(page).count()).toBeLessThanOrEqual(30);
    await expect(row(page, 50_002)).toContainText('Ledger 50001');
  });

  test('edits a cell, scrolls it away and back, and keeps the value', async ({ page }) => {
    await open(page);
    await cell(page, 2, 1).dblclick();
    const input = grid(page).getByRole('textbox', { name: 'Ledger' });
    await expect(input).toBeFocused();
    await input.fill('Ledger one, renamed');
    await input.press('Enter');
    await expect(cell(page, 2, 1)).toHaveText('Ledger one, renamed');

    // Move the active cell far away, so the edited row leaves the DOM.
    await cell(page, 2, 1).press('Control+End');
    await expect(cell(page, 100_001, 4)).toBeFocused();
    await expect(row(page, 2)).toHaveCount(0);
    await area(page).evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(cell(page, 2, 1)).toHaveText('Ledger one, renamed');
  });

  test('keeps the open editor and its draft across scrolling', async ({ page }) => {
    await open(page);
    await cell(page, 3, 2).dblclick();
    const input = grid(page).getByRole('textbox', { name: 'Owner' });
    await input.fill('Dee Hart');
    await area(page).evaluate((element) => {
      element.scrollTop = 41 * 80_000;
    });
    await expect(row(page, 80_002)).toBeAttached();
    expect(await bodyRows(page).count()).toBeLessThanOrEqual(30);
    await expect(input).toHaveValue('Dee Hart');
    await area(page).evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(input).toBeFocused();
    await input.press('Enter');
    await expect(cell(page, 3, 2)).toHaveText('Dee Hart');
  });

  test('an open editor keeps its width and the scroll position while the window changes', async ({
    page,
  }) => {
    await open(page);
    await cell(page, 3, 2).dblclick();
    const input = grid(page).getByRole('textbox', { name: 'Owner' });
    await expect(input).toBeFocused();
    const width = () => input.evaluate((node) => node.getBoundingClientRect().width);
    const before = await width();
    // The far window holds other text, so auto-sized columns change width.
    // WebKit scrolls back to a focused field's caret when the field resizes.
    await area(page).evaluate((element) => {
      element.scrollTop = 41 * 80_000;
    });
    await expect(row(page, 80_002)).toBeAttached();
    expect(await width()).toBe(before);
    expect(await area(page).evaluate((element) => element.scrollTop)).toBe(41 * 80_000);
  });

  test('navigates the full set with Ctrl+End, Page Up/Down and Ctrl+Home', async ({ page }) => {
    await open(page);
    await cell(page, 2, 1).click();
    await expect(cell(page, 2, 1)).toBeFocused();
    await page.keyboard.press('Control+End');
    const last = cell(page, 100_001, 4);
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await expect(row(page, 100_001)).toContainText('Ledger 100000');

    await page.keyboard.press('PageUp');
    const focusedRow = () =>
      page.evaluate(() =>
        Number(document.activeElement?.closest('tr')?.getAttribute('aria-rowindex'))
      );
    const afterPageUp = await focusedRow();
    expect(afterPageUp).toBeLessThan(100_001);
    expect(afterPageUp).toBeGreaterThan(99_980);
    // The focused cell is on screen and not under the sticky header.
    expect(
      await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement;
        const box = focused.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return focused.contains(hit);
      })
    ).toBe(true);
    await page.keyboard.press('PageDown');
    await expect(last).toBeFocused();

    // F2 edits the cell keyboard focus reached.
    await page.keyboard.press('F2');
    await expect(grid(page).getByRole('textbox', { name: 'Amount' })).toBeFocused();
    await page.keyboard.press('Escape');

    await last.press('Control+Home');
    await expect(grid(page).locator('thead [aria-colindex="1"] button')).toBeFocused();
    await expect(row(page, 2)).toBeInViewport();
  });

  test(`passes axe while windowed and scrolled in light and dark`, async ({ page }) => {
    for (const mode of ['light', 'dark'] as const) {
      await open(page, mode);
      await area(page).evaluate((element) => {
        element.scrollTop = 41 * 33_333;
      });
      await expect(row(page, 33_335)).toBeAttached();
      const results = await new AxeBuilder({ page })
        .include(`[data-example="${ID}"]`)
        .withTags(AXE_TAGS)
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
