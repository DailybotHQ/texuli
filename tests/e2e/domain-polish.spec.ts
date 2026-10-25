import { expect, type Page, test } from '@playwright/test';

/**
 * Regressions from the component polish audit (PLAN_005 Task 11,
 * POLISH_AUDIT.md) for the domain packages: charts, data, media and chat.
 * Each case names its audit finding.
 */

async function openExample(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/?fixture=${id}&mode=light`);
  const host = page.locator(`[data-example-host="${id}"]`);
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host.locator(':scope > p[role="status"]')).toHaveCount(0, { timeout: 20_000 });
  return host;
}

async function expectNoPageScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'document scroll width').toBeLessThanOrEqual(client);
}

/** The smallest rendered size (CSS px on screen) of the visible SVG text in `root`. */
async function smallestSvgText(page: Page, root: string) {
  return page.locator(root).evaluate((host) => {
    let smallest = { px: Number.POSITIVE_INFINITY, text: '' };
    for (const text of host.querySelectorAll<SVGTextElement>('svg text')) {
      const box = text.getBoundingClientRect();
      if (!box.width || !box.height || !text.textContent?.trim()) continue;
      if (text.closest('[aria-hidden="true"] [hidden], [hidden]')) continue;
      const matrix = text.getScreenCTM();
      const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
      const px = Number.parseFloat(getComputedStyle(text).fontSize) * scale;
      if (px < smallest.px) smallest = { px, text: text.textContent.trim().slice(0, 24) };
    }
    return smallest;
  });
}

test.describe('domain polish · chart text keeps its size on phones (P1-01)', () => {
  const charts = [
    'charts-cartesian',
    'charts-matrix',
    'charts-statistical',
    'charts-histogram',
    'charts-rtl',
    'charts-windowed',
    'charts-canvas',
    'charts-flow',
  ];
  for (const id of charts) {
    test(`${id} at 320px`, async ({ page }) => {
      await openExample(page, id, 320);
      // Let measured layouts settle (a ResizeObserver tick after mount).
      await page.waitForTimeout(300);
      const smallest = await smallestSvgText(page, `[data-example-host="${id}"]`);
      expect(smallest.px, `smallest chart text "${smallest.text}"`).toBeGreaterThanOrEqual(10);
    });
  }
});

test('charts-interaction fits a 320px phone (P1-12)', async ({ page }) => {
  await openExample(page, 'charts-interaction', 320);
  await expectNoPageScroll(page);
  const plot = await page.locator('.tx-chart-plot').first().boundingBox();
  expect(plot?.width ?? 0).toBeLessThanOrEqual(320);
});

test('cartesian series keep distinct colors in forced colors (P1-13)', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const host = await openExample(page, 'charts-cartesian', 1280);
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
});

test('the audio waveform spans its player (P1-14)', async ({ page }) => {
  for (const width of [412, 1280]) {
    const host = await openExample(page, 'media-audio', width);
    // The drawn peaks, not the SVG box: the box was always full width, the
    // drawing inside it was letterboxed to about 150px.
    const sizes = await host
      .locator('.tx-audio-waveform')
      .first()
      .evaluate((svg) => {
        const bars = [...svg.querySelectorAll('rect')].map((bar) => bar.getBoundingClientRect());
        const start = Math.min(...bars.map((bar) => bar.left));
        const end = Math.max(...bars.map((bar) => bar.right));
        return { drawn: end - start, box: svg.getBoundingClientRect().width };
      });
    expect(sizes.drawn, `${width}px: drawn peaks vs the waveform box`).toBeGreaterThan(
      sizes.box * 0.95
    );
  }
});

test('video controls are token-styled with real touch targets (P1-15)', async ({ page }) => {
  const host = await openExample(page, 'media-video', 412);
  const controls = host.locator('[data-tx-video-controls]').first();
  const play = controls.getByRole('button', { name: 'Play video' });
  const playBox = await play.boundingBox();
  expect(playBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(await play.locator('svg').count()).toBe(1);
  const seek = await controls.locator('input[type="range"]').boundingBox();
  expect(seek?.height ?? 0, 'seek hit area').toBeGreaterThanOrEqual(24);
  const appearances = await controls
    .locator('select')
    .evaluateAll((selects) => selects.map((select) => getComputedStyle(select).appearance));
  expect(appearances.length).toBeGreaterThan(0);
  expect(new Set(appearances)).toEqual(new Set(['none']));
  // The transport (play, seek, time) shares one row on a phone.
  expect(
    Math.abs(
      (seek?.y ?? 0) + (seek?.height ?? 0) / 2 - ((playBox?.y ?? 0) + (playBox?.height ?? 0) / 2)
    )
  ).toBeLessThan(4);
});

test.describe('calendar week view on a phone (P1-16)', () => {
  test('day headings scroll with their columns', async ({ page }) => {
    const host = await openExample(page, 'data-calendar', 412);
    await expect(host.locator('[data-day-column]').first()).toBeVisible({ timeout: 15_000 });
    await expectNoPageScroll(page);
    const scroller = host.locator('[data-time-view]');
    await scroller.evaluate((element) => {
      element.scrollLeft = 200;
    });
    const offsets = await host.evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('[data-day-column]')].map((column) => {
        const date = column.dataset.dayColumn;
        const heading = root.querySelector(
          `.tx-calendar__day-heading[data-calendar-date="${date}"]`
        );
        return Math.abs(
          column.getBoundingClientRect().left -
            (heading?.getBoundingClientRect().left ?? Number.NaN)
        );
      })
    );
    expect(offsets.length).toBe(7);
    for (const offset of offsets) expect(offset).toBeLessThan(1.5);
    // Each day keeps a readable column instead of seven slivers.
    const width = await host
      .locator('[data-day-column]')
      .first()
      .evaluate((c) => c.clientWidth);
    expect(width).toBeGreaterThanOrEqual(80);
  });

  test('event tones render from tokens', async ({ page }) => {
    const host = await openExample(page, 'data-calendar', 1280);
    const primary = host.locator('.tx-calendar__event[data-tone="primary"]').first();
    const success = host.locator('.tx-calendar__event[data-tone="success"]').first();
    await expect(primary).toBeVisible({ timeout: 15_000 });
    const [a, b] = await Promise.all(
      [primary, success].map((chip) => chip.evaluate((el) => getComputedStyle(el).backgroundColor))
    );
    expect(a).not.toBe(b);
  });
});

test('a narrow data grid keeps rows on one line and stays keyboard-reachable (P1-17)', async ({
  page,
}) => {
  const host = await openExample(page, 'data-grid-core', 412);
  const grid = host.locator('.tx-data-grid').first();
  const wrap = grid.locator('.tx-table-wrap').first();
  const cells = grid.locator('tbody tr').first().locator('td');
  await expect(cells.nth(1)).toBeVisible();
  // One line: a wrapped name was about three lines tall.
  const heights = await cells.evaluateAll((all) =>
    all.slice(1).map((cell) => cell.getBoundingClientRect().height)
  );
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
  // The table scrolls inside its wrapper, not the page.
  expect(await wrap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expectNoPageScroll(page);
  // Walking the row by keyboard keeps every focused cell on screen and on top.
  const count = await cells.count();
  await cells.nth(count - 1).click();
  for (let step = 0; step < count - 1; step += 1) {
    await page.keyboard.press('ArrowLeft');
    const visible = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement;
      const box = focused.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return focused.contains(hit);
    });
    expect(visible, `focused cell after ${step + 1} ArrowLeft`).toBe(true);
  }
});

test('the active virtual-list row is marked, forced colors included (P1-18)', async ({ page }) => {
  for (const forced of [false, true]) {
    await page.emulateMedia({ forcedColors: forced ? 'active' : 'none' });
    const host = await openExample(page, 'data-virtual-list', 1280);
    const active = host.locator('.row[aria-selected="true"]').first();
    const other = host.locator('.row[aria-selected="false"]').first();
    await expect(active).toBeVisible();
    const [a, b] = await Promise.all(
      [active, other].map((row) =>
        row.evaluate((el) => {
          const style = getComputedStyle(el);
          return `${style.backgroundColor}|${style.borderInlineStartColor}`;
        })
      )
    );
    expect(a, forced ? 'forced colors' : 'default').not.toBe(b);
  }
});
