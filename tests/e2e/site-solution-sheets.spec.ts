import { expect, type Locator, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/sheets/ (the Sheets Solution landing), on the built site
 * (`pnpm build` first), following the Slides landing spec:
 *
 * 1. the page: one h1, the registry status, the subnav anchors, the static grid preview
 *    in the server HTML before any script runs, no console errors and no CSP violations;
 * 2. the demo island: it hydrates when scrolled into view; editing a quantity recalculates
 *    the row and grand totals; Add line item works from the keyboard; Reset restores the
 *    fixture; View source shows the workbook as plain JSON;
 * 3. the Markdown twin at /solutions/sheets.md;
 * 4. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark.
 *
 * Copy and content are unit-tested in apps/website/tests/solutions/sheets-*.test.ts.
 */

const origin = serveDist();
const ROUTE = '/solutions/sheets/';

/** Every CSP violation and console error the page raises, from before its first script. */
async function watchProblems(page: Page): Promise<() => Promise<string[]>> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`csp: ${event.effectiveDirective} ${event.blockedURI || 'inline'}`);
    });
  });
  return async () => [
    ...errors,
    ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
  ];
}

async function useScheme(page: Page, colorScheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
}

const demo = (page: Page) => page.locator('[data-tx-sheets-demo]');
const island = (page: Page) => page.locator('astro-island:has([data-tx-sheets-demo])');
const status = (page: Page) => demo(page).locator('.sheets-demo__announcement');
const controls = (page: Page) => demo(page).getByRole('group', { name: 'Spreadsheet actions' });
const grid = (page: Page) => demo(page).getByRole('grid', { name: 'Project budget spreadsheet' });

/** The gridcell at a 0-based sheet row and column of the live demo grid. */
function cell(target: Locator, row: number, col: number): Locator {
  return target.locator(`tr[aria-rowindex="${row + 1}"] [aria-colindex="${col + 1}"]`);
}

/** Opens the cell editor from the keyboard, types `value`, and commits with Enter. */
async function editCell(target: Locator, row: number, col: number, value: string): Promise<void> {
  const current = cell(target, row, col);
  await current.click();
  await current.press('Enter');
  const editor = current.locator('[data-tx-grid-editor]');
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await editor.press('Enter');
}

/** Scrolls the demo into view and waits for the island to hydrate. There is no Start button. */
async function startDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-sheets-demo]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(grid(page)).toBeVisible({ timeout: 20_000 });
  await expect(status(page)).toContainText('Project budget loaded');
}

test('the landing renders its sections, status and server preview, with no errors', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  // The static preview and the hero are in the server HTML, before hydration.
  expect(html).toContain('data-tx-sheets-demo-preview="project-budget"');
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A spreadsheet with formulas built to recalculate.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: in development/);
  // The server preview ships in the HTML; the island renders the same live view, so the frame
  // shows one of them: the preview steps aside ([data-demo-live]).
  await expect(page.locator('[data-tx-sheets-demo-preview]')).toHaveCount(1);
  await expect(page.locator('[data-tx-sheets-demo-preview]')).toBeHidden();
  await expect(page.locator('[data-tx-sheets-demo][data-demo-live]')).toBeVisible();
  // The island has not hydrated while it is below the fold.
  await expect(island(page)).toHaveAttribute('ssr', '');

  const subnav = page.getByRole('navigation', { name: 'Sheets page sections' });
  const links = subnav.locator('a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(6);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
    const id = (href ?? '').slice(1);
    await expect(page.locator(`[id="${id}"]`), href ?? '').toHaveCount(1);
  }
  await subnav.getByRole('link', { name: 'How it works' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#how-it-works');
  await expect(page.locator('#how-it-works')).toBeInViewport();

  // No link to the page this landing replaces.
  await expect(page.locator('a[href*="/sheets-page/"]')).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('the demo hydrates on scroll; editing a cell recalculates, then reset restores it', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);

  const live = grid(page);
  await expect(cell(live, 2, 4)).toContainText('360');
  await expect(cell(live, 5, 4)).toContainText('766');

  // Quantity B2 from 3 to 4: D2 (B2*C2) and D5 (SUM) recalculate.
  await editCell(live, 2, 2, '4');
  await expect(status(page)).toContainText('Edited Budget!B2');
  await expect(cell(live, 2, 4)).toContainText('480');
  await expect(cell(live, 5, 4)).toContainText('886');

  // Add a line item from the keyboard; the grand total range grows.
  await controls(page).getByRole('button', { name: 'Add line item' }).focus();
  await page.keyboard.press('Enter');
  await expect(status(page)).toContainText('Added an accessibility review row');
  await expect(cell(live, 6, 4)).toContainText('1056');

  await controls(page).getByRole('button', { name: 'Show formula details' }).click();
  const formulas = demo(page).locator('.sheets-demo__formulas');
  await expect(formulas.getByText('5 formulas in this workbook')).toBeVisible();
  await expect(formulas.getByText('=SUM(D2:D5)', { exact: true })).toBeVisible();

  // View source shows the workbook as plain text, not markup.
  await controls(page).getByRole('button', { name: 'View source' }).click();
  const source = demo(page).locator('#sheets-demo-source');
  await expect(source).toBeVisible();
  const text = (await source.locator('code').textContent()) ?? '';
  expect(JSON.parse(text).meta.title).toBe('Project budget');
  expect(await source.locator('code *').count()).toBe(0);

  // Reset returns to the starting workbook.
  await controls(page).getByRole('button', { name: 'Reset' }).click();
  await expect(status(page)).toContainText('Example reset.');
  await expect(status(page)).toContainText('Reset to the original Project budget');
  await expect(cell(live, 2, 4)).toContainText('360');
  await expect(cell(live, 5, 4)).toContainText('766');
  await expect(demo(page).getByText('5 formulas in this workbook')).toHaveCount(0);
  await expect(source).toBeHidden();

  expect(await problems()).toEqual([]);
});

test('the Markdown twin carries the landing', async () => {
  const response = await fetch(`${origin()}/solutions/sheets.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await response.text();
  expect(body).toContain('A spreadsheet with formulas built to recalculate.');
  expect(body).toContain('https://texuli.com/solutions/sheets/');
  expect(body).toContain('Status: in development');
  expect(body).toContain('catalog.search');
});

test('at 390 px nothing overflows; axe has no serious violations in light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);
  expect(await polishProblems(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  // Back to the top: the 390 px run leaves the demo toolbar under the sticky header, which axe
  // reads as an obscured (too small) target. The page is checked at rest.
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    const serious = (await axeViolations(page)).filter((v) => /\((serious|critical)\)/.test(v));
    expect(serious, scheme).toEqual([]);
  }
});
