import { expect, type Locator, type Page, test } from '@playwright/test';
import { axeViolations, expectMode, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /sheets-page/ (PLAN_010 T-site-080), in the browser:
 *
 * 1. the workbook edits a cell from the keyboard, the dependents
 *    recalculate (in the grid and in the panel, with the engine's counts),
 *    a structural edit rewrites the total's range; every function row is
 *    listed with its build-time result; axe in light and dark with every
 *    island hydrated;
 * 2. the function lab evaluates a picked function and reports a formula
 *    that does not parse; the CSV lab keeps formulas as text, neutralizes
 *    them on export (a real download) and refuses the file with formulas on;
 * 3. the player paints the agent spreadsheet read-only and refuses the
 *    INDIRECT workbook; at 360 px nothing overflows.
 *
 * Data and copy are unit-tested in apps/website/tests/site-sheets.test.ts.
 */

const origin = serveDist();

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function open(page: Page): Promise<string[]> {
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/sheets-page/`);
  await settle(page);
  return foreign;
}

/** The gridcell at a 1-based sheet row and column (A is 1) of a sheet grid. */
function cell(grid: Locator, row: number, col: number): Locator {
  return grid.locator(`tr[aria-rowindex="${row + 1}"] [aria-colindex="${col + 1}"]`);
}

async function edit(grid: Locator, row: number, col: number, value: string): Promise<void> {
  const target = cell(grid, row, col);
  await target.click();
  await target.press('Enter');
  const editor = target.locator('[data-tx-grid-editor]');
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await editor.press('Enter');
}

test('the workbook: keyboard edits recalculate dependents, rows rewrite ranges; axe light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foreign = await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Spreadsheets with a formula engine you can trust'
  );
  await expect(page.getByText('@texuli/sheets · in development · on npm from 0.8.0')).toBeVisible();
  await expect(page.locator('[data-sheets-function]')).toHaveCount(54);
  await expect(page.locator('[data-sheets-function="SUMIF"] [data-sheets-result]')).toHaveText(
    '820'
  );
  await expect(page.locator('[data-sheets-case="limit"]')).toContainText('#LIMIT!');
  await expect(page.locator('[data-sheets-case="cycle"]')).toContainText('#CYCLE!');

  await hydrated(page, '[data-sheets-workbench]');
  const grid = page
    .locator('[data-sheets-workbench]')
    .getByRole('grid', { name: 'Harbor order log' });
  await expect(grid).toBeVisible({ timeout: 20_000 });
  // B11 is the total: =SUM(B2:B9).
  await expect(cell(grid, 11, 2)).toContainText('1110.75');
  await edit(grid, 2, 2, '200');
  await expect(cell(grid, 11, 2)).toContainText('1190.75');
  const status = page.locator('[data-sheets-recalc]');
  await expect(status).toContainText('Edited Orders!B2');
  await expect(status).toContainText('of 10 formulas evaluated');
  await expect(page.locator('[data-sheets-formula="Orders!B11"]')).toHaveAttribute(
    'data-changed',
    'true'
  );
  // The open-order count does not read amounts: not recalculated.
  await expect(page.locator('[data-sheets-formula="Summary!B3"]')).toHaveAttribute(
    'data-changed',
    'false'
  );
  // The formula bar shows what was typed in the focused cell.
  await cell(grid, 11, 2).click();
  await expect(page.locator('[data-tx-sheet-bar]')).toContainText('=SUM(B2:B9)');

  // Two rows above row 5: the total moves to B13 and its range grows.
  await page.getByRole('button', { name: 'Insert two rows above row 5' }).click();
  await expect(page.locator('[data-sheets-formula="Orders!B13"]')).toContainText('=SUM(B2:B11)');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('[data-sheets-formula="Orders!B11"]')).toContainText('=SUM(B2:B9)');

  for (const selector of ['[data-sheets-lab]', '[data-sheets-csv]', '[data-sheets-agent]']) {
    await hydrated(page, selector);
  }
  await expect(page.locator('[data-sheets-agent-stage]').getByRole('grid')).toBeVisible({
    timeout: 20_000,
  });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectMode(page, scheme);
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('the function lab and the CSV lab: results, parse errors, injection neutralized', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await open(page);
  await hydrated(page, '[data-sheets-lab]');
  const lab = page.locator('[data-sheets-lab]');
  await lab.getByLabel('Function').selectOption('VLOOKUP');
  await expect(lab.getByLabel('Formula in K1')).toHaveValue('=VLOOKUP("Quito", A2:C9, 3, FALSE)');
  await expect(page.locator('[data-sheets-lab-value]')).toHaveText('open');
  await lab.getByLabel('Formula in K1').fill('=INDIRECT("A1")');
  await expect(page.locator('[data-sheets-lab-error]')).toHaveText('#NAME?');
  await expect(page.locator('[data-sheets-lab-result]')).toContainText(
    'INDIRECT is not a sheet function'
  );

  await hydrated(page, '[data-sheets-csv]');
  const exported = page.locator('[data-sheets-csv-export]');
  await expect(exported).toContainText(`Quito,-5,'+1+1`);
  await expect(exported).toContainText(`Bogota,3.5,'@SUM(A1)`);
  await expect(page.locator('[data-sheets-csv-cell="C5"]')).toContainText('=SUM(B2:B4)');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('orders-export.csv');
  await page.getByLabel('Import formulas').check();
  await expect(page.locator('[data-sheets-csv-refused]')).toContainText(
    'HYPERLINK is not a sheet function'
  );
});

test('the player paints the agent spreadsheet and refuses INDIRECT; 360 px fits', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await hydrated(page, '[data-sheets-agent]');
  const stage = page.locator('[data-sheets-agent-stage]');
  const grid = stage.getByRole('grid', { name: 'Offsite budget sheet' });
  await expect(grid).toBeVisible({ timeout: 20_000 });
  // D7 is =SUM(D2:D5): 1200 + 444 + 156 + 504.
  await expect(cell(grid, 7, 4)).toContainText('2304');
  await page.getByRole('button', { name: 'Send the hostile workbook' }).click();
  await expect(page.locator('[data-sheets-agent-refused]')).toBeVisible({ timeout: 20_000 });
  await expect(stage.getByRole('grid')).toHaveCount(0);
  for (const selector of ['[data-sheets-workbench]', '[data-sheets-lab]', '[data-sheets-csv]']) {
    await hydrated(page, selector);
  }
  expect(await polishProblems(page)).toEqual([]);
});
