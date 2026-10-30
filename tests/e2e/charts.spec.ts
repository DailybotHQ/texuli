import { expect, type Locator, type Page, test } from '@playwright/test';

/*
 * Charts in a real browser: pointer placement, right-to-left geometry,
 * forced colors, rendered text size, native disclosure focus and a real
 * module Worker. Keyboard exploration, legends, windowing and the canvas
 * renderer's accessible fallbacks are unit-tested in packages/charts/tests;
 * every chart example passes axe in light and dark in a11y-display.spec.ts.
 * Polish audit findings P1-01, P1-12 and P1-13 (POLISH_AUDIT.md).
 */

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

/** The smallest rendered size (CSS px on screen) of the visible SVG text in `root`. */
async function smallestSvgText(root: Locator) {
  return root.evaluate((host) => {
    let smallest = { px: Number.POSITIVE_INFINITY, text: '' };
    for (const text of host.querySelectorAll<SVGTextElement>('svg text')) {
      const rect = text.getBoundingClientRect();
      if (!rect.width || !rect.height || !text.textContent?.trim()) continue;
      if (text.closest('[aria-hidden="true"] [hidden], [hidden]')) continue;
      const matrix = text.getScreenCTM();
      const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
      const px = Number.parseFloat(getComputedStyle(text).fontSize) * scale;
      if (px < smallest.px) smallest = { px, text: text.textContent.trim().slice(0, 24) };
    }
    return smallest;
  });
}

interface RunResult {
  mode: 'worker' | 'main-thread';
  answers: number;
  bins: boolean;
  lttb: boolean;
  minMax: boolean;
  binCount: number;
}

test('charts: tooltips beside their point in LTR and RTL, RTL labels, forced colors and a real worker', async ({
  page,
}) => {
  test.setTimeout(90_000);

  await test.step('pointer hover shows a tooltip beside the hovered point and hides on leave', async () => {
    const host = await openExample(page, 'charts-cartesian');
    const figure = host.locator('figure[data-kind="line"]').first();
    const plot = await box(figure.getByRole('application', { name: /Account growth/ }));
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

  await test.step('P1-13: cartesian series keep distinct colors in forced colors', async () => {
    await page.emulateMedia({ forcedColors: 'active' });
    const host = await openExample(page, 'charts-cartesian');
    const linePaths = host.locator('figure[data-kind="line"]').first().locator('path[data-line]');
    await expect(linePaths.first()).toBeAttached({ timeout: 15_000 });
    const lines = await linePaths.evaluateAll((paths) =>
      paths.map((path) => getComputedStyle(path).stroke)
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(new Set(lines).size, `line strokes ${lines.join(', ')}`).toBe(lines.length);
    const barRects = host.locator('figure[data-kind="bar"]').first().locator('rect[data-series]');
    await expect(barRects.first()).toBeAttached({ timeout: 15_000 });
    const bars = await barRects.evaluateAll((rects) => [
      ...new Set(rects.map((rect) => getComputedStyle(rect).fill)),
    ]);
    expect(bars.length, `bar fills ${bars.join(', ')}`).toBeGreaterThan(1);
    await page.emulateMedia({ forcedColors: 'none' });
  });

  await test.step('RTL: captions mirror, plot labels stay beside their marks, the tooltip stays by its point', async () => {
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
    const figure = root.locator('figure[data-kind="line"]');
    const titleBox = await box(root.getByText('الحسابات حسب الشهر'));
    const figureBox = await box(figure);
    expect(figureBox.x + figureBox.width - (titleBox.x + titleBox.width)).toBeLessThan(2);
    // Hover near the first month, at the physical left of the plot.
    const plot = await box(figure.getByRole('application'));
    await page.mouse.move(plot.x + plot.width * 0.2, plot.y + plot.height * 0.5);
    const tooltip = figure.locator('[data-chart-tooltip]');
    await expect(tooltip).toBeVisible();
    // A mirrored (inline-start) tooltip would land near the right edge instead.
    expect((await box(tooltip)).x).toBeLessThan(plot.x + plot.width / 2);
  });

  // A real module Worker loaded with the documented host pattern
  // (`new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })`)
  // must return exactly the synchronous bin, LTTB and min-max results, and a
  // worker constructor that throws must fall back to the main thread.
  await test.step('chart offload runs in a real worker and falls back when workers are blocked', async () => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/worker.html');
    await expect(page.locator('#status')).toHaveText('Done', { timeout: 30_000 });
    const result = await page.evaluate(
      () =>
        (window as unknown as { __chartWorker: { worker: RunResult; fallback: RunResult } })
          .__chartWorker
    );
    expect(result.worker).toMatchObject({
      mode: 'worker',
      answers: 3,
      bins: true,
      lttb: true,
      minMax: true,
    });
    expect(result.worker.binCount).toBeGreaterThan(1);
    expect(result.fallback).toMatchObject({
      mode: 'main-thread',
      answers: 0,
      bins: true,
      lttb: true,
      minMax: true,
    });
    expect(errors).toEqual([]);
  });
});

// G96 (Protoyard): in a figure wider than the 640px layout, the plot keeps
// its 640px box while the canvas layer used to stretch across the figure, so
// the marks drew off the axes and the keyboard explorer.
test('G96: the canvas layer shares the plot box in a 1062px figure', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  const host = await openExample(page, 'charts-canvas');
  const figure = host.locator('figure[data-kind="line"]').first();
  await figure.evaluate((node) => {
    (node as HTMLElement).style.inlineSize = '1062px';
  });
  await expect.poll(async () => (await box(figure)).width).toBe(1062);
  const canvas = figure.locator('.plot > .canvas-layer canvas');
  await expect(canvas).toBeAttached();
  const svg = figure.locator('svg[data-chart-svg]');
  await expect
    .poll(async () => {
      const [c, s] = [await box(canvas), await box(svg)];
      return [c.x - s.x, c.y - s.y, c.width - s.width, c.height - s.height].map((d) =>
        Math.round(Math.abs(d))
      );
    })
    .toEqual([0, 0, 0, 0]);
  const plot = await box(figure.locator('[data-chart-plot]'));
  expect(plot.width).toBeLessThanOrEqual(640);
  expect((await box(canvas)).width).toBeCloseTo(plot.width, 0);
});

test('every chart family on a 320px phone: readable text, no page scroll, and Tab and Enter open its data table', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 320, height: 900 });
  const problems: string[] = [];
  // P1-01: chart text keeps 10px or more; P1-12: charts-interaction fits.
  const TEXT = [
    'charts-interaction',
    'charts-cartesian',
    'charts-matrix',
    'charts-statistical',
    'charts-histogram',
    'charts-rtl',
    'charts-windowed',
    'charts-canvas',
    'charts-flow',
  ];
  const TABLES = [
    'charts-part-whole',
    'charts-matrix',
    'charts-flow',
    'charts-geo',
    'charts-compact',
    'charts-histogram',
    'charts-statistical',
  ];
  for (const id of [...new Set([...TEXT, ...TABLES])]) {
    await test.step(id, async () => {
      const host = await openExample(page, id);
      if (TEXT.includes(id)) {
        // Let measured layouts settle (a ResizeObserver tick after mount).
        await page.waitForTimeout(300);
        const smallest = await smallestSvgText(host);
        if (smallest.px < 10) problems.push(`${id}: ${smallest.px}px text "${smallest.text}"`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        if (overflow > 0) problems.push(`${id}: the page scrolls sideways by ${overflow}px`);
      }
      if (!TABLES.includes(id)) return;
      const summary = host.locator('details > summary').first();
      const details = host.locator('details').first();
      // Reach the disclosure with Tab from the element just before it.
      await summary.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(details).toHaveAttribute('open', '');
      await expect(details.locator('table tbody tr').first()).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(details).not.toHaveAttribute('open', '');
    });
  }
  expect(problems).toEqual([]);
});
