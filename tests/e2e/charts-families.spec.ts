import { expect, type Locator, type Page, test } from '@playwright/test';

/** Open a registered example and wait until its lazy module and chart chunks settle. */
async function openExample(page: Page, id: string, mode: 'light' | 'dark' = 'light') {
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  const host = page.locator(`[data-example-host="${id}"]`);
  await expect(host).toBeVisible();
  await expect(host.locator(':scope > p[role="status"]')).toHaveCount(0, { timeout: 20_000 });
  await expect(host.locator('[data-chart-pending]')).toHaveCount(0, { timeout: 20_000 });
  return host;
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Element has no layout box.');
  return rect;
}

test.describe('chart tooltips', () => {
  test('pointer hover shows a tooltip next to the hovered point and hides on leave', async ({
    page,
  }) => {
    const host = await openExample(page, 'charts-cartesian');
    const figure = host.locator('figure[data-kind="line"]').first();
    const explorer = figure.getByRole('application', { name: /Account growth/ });
    const plot = await box(explorer);
    const pointer = { x: plot.x + plot.width * 0.5, y: plot.y + plot.height * 0.5 };
    await page.mouse.move(pointer.x, pointer.y);

    const tooltip = figure.locator('[data-chart-tooltip]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('New accounts');
    await expect(tooltip).toContainText('Returning accounts');
    const tip = await box(tooltip);
    // Placed beside the snapped point, never across the plot.
    expect(Math.abs(tip.x + tip.width / 2 - pointer.x)).toBeLessThan(plot.width / 2);

    await page.mouse.move(plot.x + plot.width + 200, plot.y - 200);
    await expect(tooltip).toHaveCount(0);
  });
});

test.describe('chart legends', () => {
  test('legend buttons toggle series by keyboard and keep one series visible', async ({ page }) => {
    const host = await openExample(page, 'charts-cartesian');
    const figure = host.locator('figure[data-kind="line"]').first();
    const legend = figure.getByRole('list', { name: /Account growth series/ });
    const newAccounts = legend.getByRole('button', { name: 'New accounts' });
    const returning = legend.getByRole('button', { name: 'Returning accounts' });

    await expect(newAccounts).toHaveAttribute('aria-pressed', 'true');
    await newAccounts.focus();
    await page.keyboard.press('Space');
    await expect(newAccounts).toHaveAttribute('aria-pressed', 'false');
    await expect(figure.locator('[data-line="new"]')).toHaveCount(0);

    // The last visible series is locked: pressing it does not hide it.
    await expect(returning).toHaveAttribute('aria-disabled', 'true');
    await returning.focus();
    await page.keyboard.press('Enter');
    await expect(returning).toHaveAttribute('aria-pressed', 'true');
    await expect(figure.locator('[data-line="returning"]')).toHaveCount(1);

    await newAccounts.focus();
    await page.keyboard.press('Enter');
    await expect(newAccounts).toHaveAttribute('aria-pressed', 'true');
    await expect(figure.locator('[data-line="new"]')).toHaveCount(1);
  });
});

test.describe('windowed cartesian series (visibleDomain)', () => {
  test('axes, marks and keyboard exploration follow the visible window', async ({ page }) => {
    const host = await openExample(page, 'charts-windowed');
    const figure = host.locator('figure[data-kind="line"]');
    const explorer = figure.getByRole('application', { name: /Latency by request/ });
    const live = figure.locator('[data-chart-live]');

    await expect(host.locator('[data-window]')).toHaveText('Showing requests 40 to 60');
    await explorer.focus();
    // 21 in-window samples plus one neighbor on each side keep the line continuous.
    await expect(live).toContainText(/Point 1 of 2[1-3]\./);
    await page.keyboard.press('End');
    await expect(live).toContainText(/Latency, (6[01]|59)\b/);

    await host.getByRole('button', { name: 'Next window' }).click();
    await expect(host.locator('[data-window]')).toHaveText('Showing requests 60 to 80');
    await explorer.focus();
    await page.keyboard.press('Home');
    await expect(live).toContainText(/Latency, (59|60)\b/);

    await host.getByRole('button', { name: 'Full range' }).click();
    await explorer.focus();
    await expect(live).toContainText(/Point \d+ of 200\./);
  });
});

test.describe('accessible data tables by keyboard', () => {
  test('the cartesian table toggle opens and closes with Enter and Space', async ({ page }) => {
    const host = await openExample(page, 'charts-cartesian');
    const figure = host.locator('figure[data-kind="line"]').first();
    const toggle = figure.getByRole('button', { name: 'Show data table' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    const table = figure.getByRole('table', { name: /Account growth data/ });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader').first()).toBeVisible();
    const hide = figure.getByRole('button', { name: 'Hide data table' });
    await expect(hide).toBeFocused();
    await page.keyboard.press('Space');
    await expect(table).toHaveCount(0);
  });

  for (const id of [
    'charts-part-whole',
    'charts-matrix',
    'charts-flow',
    'charts-geo',
    'charts-compact',
    'charts-histogram',
    'charts-statistical',
  ]) {
    test(`${id}: Tab reaches each data-table disclosure and Enter opens it`, async ({ page }) => {
      const host = await openExample(page, id);
      const summaries = host.locator('details > summary');
      const count = await summaries.count();
      expect(count, `${id} renders data-table disclosures`).toBeGreaterThan(0);
      const summary = summaries.first();
      const details = host.locator('details').first();

      // Reach the disclosure with Tab from the element just before it.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await summary.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(summary).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(details).toHaveAttribute('open', '');
      const table = details.locator('table');
      await expect(table).toBeVisible();
      await expect(table.locator('tbody tr').first()).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(details).not.toHaveAttribute('open', '');
    });
  }
});

test.describe('canvas renderer', () => {
  test('dense series draw on canvas and stay accessible through SVG and the table', async ({
    page,
  }) => {
    const host = await openExample(page, 'charts-canvas');
    const figure = host.locator('figure[data-kind="line"]').first();
    const canvas = figure.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    // The 100,000 points are not emitted as SVG marks.
    await expect(figure.locator('[data-line]')).toHaveCount(0);
    await expect(figure.getByRole('img', { name: /Daily activity at scale/ })).toBeVisible();

    const explorer = figure.getByRole('application', { name: /Daily activity at scale/ });
    await explorer.focus();
    const live = figure.locator('[data-chart-live]');
    await expect(live).toContainText(/Point 1 of \d+\./);
    const total = Number((await live.textContent())?.match(/of (\d+)\./)?.[1]);
    // Keyboard exploration runs on the downsampled series, not every sample.
    expect(total).toBeGreaterThan(1);
    expect(total).toBeLessThan(100_000);

    await figure.getByRole('button', { name: 'Show data table' }).click();
    await expect(figure.getByRole('table', { name: /Daily activity at scale data/ })).toBeVisible();
  });
});

test.describe('right-to-left layouts', () => {
  test('captions mirror while plot labels stay beside their marks', async ({ page }) => {
    const host = await openExample(page, 'charts-rtl');
    const root = host.locator('[data-example="charts-rtl"]');
    await expect(root).toHaveAttribute('dir', 'rtl');

    for (const svg of await root.locator('svg[role="img"]').all()) {
      expect(await svg.evaluate((node) => getComputedStyle(node).direction)).toBe('ltr');
    }

    // Heatmap row labels end left of the first column of cells.
    const heatmap = root.locator('figure').filter({ hasText: 'الجهد حسب اليوم' });
    const rowLabel = heatmap.locator('svg text').filter({ hasText: 'التصميم' }).first();
    const cellLeft = Math.min(
      ...(await heatmap
        .locator('svg rect[data-cell]')
        .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().left)))
    );
    expect(Number.isFinite(cellLeft)).toBe(true);
    // Measure label and cells the same way (WebKit's boundingBox differs for SVG text).
    const labelRight = await rowLabel.evaluate((node) => node.getBoundingClientRect().right);
    expect(labelRight).toBeLessThanOrEqual(cellLeft + 1);

    // Captions follow the document direction: right-aligned in RTL.
    const title = root.getByText('الحسابات حسب الشهر');
    const figure = root.locator('figure[data-kind="line"]');
    const titleBox = await box(title);
    const figureBox = await box(figure);
    expect(figureBox.x + figureBox.width - (titleBox.x + titleBox.width)).toBeLessThan(2);
  });

  test('the tooltip stays next to its point in RTL', async ({ page }) => {
    const host = await openExample(page, 'charts-rtl');
    const figure = host.locator('figure[data-kind="line"]');
    const explorer = figure.getByRole('application');
    const plot = await box(explorer);
    // Hover near the first month, at the physical left of the plot.
    const pointer = { x: plot.x + plot.width * 0.2, y: plot.y + plot.height * 0.5 };
    await page.mouse.move(pointer.x, pointer.y);
    const tooltip = figure.locator('[data-chart-tooltip]');
    await expect(tooltip).toBeVisible();
    const tip = await box(tooltip);
    // A mirrored (inline-start) tooltip would land near the right edge instead.
    expect(tip.x).toBeLessThan(plot.x + plot.width / 2);
  });
});
