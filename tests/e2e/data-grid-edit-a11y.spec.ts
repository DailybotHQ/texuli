import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * FIX-grid-edit-a11y: on both editing examples (plain and 100,000 windowed
 * rows), Enter or F2 on a clicked cell and a double click all put focus in
 * the cell editor, which carries the stable data-tx-grid-editor hook and is
 * on screen. axe passes in light and dark with an editor open.
 */

const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];

const EXAMPLES = [
  { id: 'data-grid-editing', grid: 'Harbor deals', text: 'Harbor Notes renewal' },
  { id: 'data-grid-editing-virtual', grid: 'Fictional ledgers', text: 'Ledger 1' },
] as const;

async function open(page: Page, id: string, mode: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: mode });
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  await expect(page.locator(`[data-example="${id}"]`)).toBeVisible({ timeout: 30_000 });
}

for (const example of EXAMPLES) {
  test.describe(`grid editing a11y · ${example.id}`, () => {
    const grid = (page: Page) => page.getByRole('grid', { name: example.grid });
    const cell = (page: Page) =>
      grid(page).getByRole('gridcell', { name: example.text, exact: true });
    const editor = (page: Page) => grid(page).locator('[data-tx-grid-editor]');

    for (const key of ['Enter', 'F2'] as const) {
      test(`${key} on a clicked cell focuses the editor`, async ({ page }) => {
        await open(page, example.id);
        await cell(page).click();
        await page.keyboard.press(key);
        await expect(editor(page)).toBeFocused();
        await expect(editor(page)).toHaveValue(example.text);
        await expect(editor(page)).toBeInViewport();
        await page.keyboard.press('Escape');
        await expect(editor(page)).toHaveCount(0);
        await expect(cell(page)).toBeFocused();
      });
    }

    test('a double click focuses the editor', async ({ page }) => {
      await open(page, example.id);
      await cell(page).dblclick();
      await expect(editor(page)).toBeFocused();
      await expect(editor(page)).toHaveValue(example.text);
    });

    for (const mode of ['light', 'dark'] as const) {
      test(`passes axe with an editor open (${mode})`, async ({ page }) => {
        await open(page, example.id, mode);
        await cell(page).click();
        await page.keyboard.press('Enter');
        await expect(editor(page)).toBeFocused();
        const results = await new AxeBuilder({ page })
          .include(`[data-example="${example.id}"]`)
          .withTags(AXE_TAGS)
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}
