import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

/*
 * Data views in a real browser: what needs layout, real scrolling, real
 * pointer input or the browser's own shortcuts. Keyboard maps, naming,
 * windowing counts and the edit engine are unit-tested in
 * packages/data/tests (grid-edit-*.test.ts, calendar-*.test.ts,
 * board.test.ts); every example also passes axe in light and dark in
 * a11y-display.spec.ts. One test per area, one page session each.
 *
 * Fixed bugs guarded here: FIX-grid-edit-a11y, FIX-grid-edit-virtual,
 * FIX-calendar-host-parity, FIX-calendar-reschedule and the polish audit's
 * P1-16, P1-17 and P1-18 (POLISH_AUDIT.md).
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

async function open(page: Page, id: string, mode: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: mode });
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  await expect(page.locator(`[data-example="${id}"]`)).toBeVisible({ timeout: 30_000 });
}

async function axe(page: Page, ...include: string[]): Promise<string[]> {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  for (const selector of include) builder = builder.include(selector);
  const results = await builder.analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

async function expectNoPageScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'document scroll width').toBeLessThanOrEqual(client);
}

/** The focused element is on screen and on top (not under a sticky header). */
async function focusedOnTop(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const focused = document.activeElement as HTMLElement;
    const box = focused.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return focused.contains(hit);
  });
}

test('data grid: editors on screen, 100,000 windowed rows under real scrolling, narrow grid, axe with an editor open', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const ID = 'data-grid-editing-virtual';
  const grid = page.getByRole('grid', { name: 'Fictional ledgers' });
  const bodyRows = grid.locator('tbody tr[aria-rowindex]');
  const row = (index: number) => grid.locator(`tr[aria-rowindex="${index}"]`);
  const cell = (index: number, col: number) => row(index).locator(`[aria-colindex="${col}"]`);
  /** The demo passes rowSize={41}, so row n starts n * 41 px down the body. */
  const area = page.locator(`[data-example="${ID}"] [data-tx-table-wrap]`);
  const scrollTo = (top: number) =>
    area.evaluate((element, value) => {
      element.scrollTop = value;
    }, top);
  const problems: string[] = [];

  await test.step('Enter and F2 on a clicked cell open an editor that is focused and on screen', async () => {
    for (const example of [
      { id: 'data-grid-editing', grid: 'Harbor deals', text: 'Harbor Notes renewal' },
      { id: ID, grid: 'Fictional ledgers', text: 'Ledger 1' },
    ]) {
      await open(page, example.id);
      const host = page.getByRole('grid', { name: example.grid });
      const target = host.getByRole('gridcell', { name: example.text, exact: true });
      const editor = host.locator('[data-tx-grid-editor]');
      for (const key of ['Enter', 'F2']) {
        await target.click();
        await page.keyboard.press(key);
        await expect(editor).toBeFocused();
        await expect(editor).toHaveValue(example.text);
        await expect(editor).toBeInViewport();
        await page.keyboard.press('Escape');
        await expect(editor).toHaveCount(0);
        await expect(target).toBeFocused();
      }
    }
  });

  await test.step('the window stays bounded while scrolling and an edit survives leaving the DOM', async () => {
    await open(page, ID);
    await expect(grid).toHaveAttribute('aria-rowcount', '100001');
    expect(await bodyRows.count()).toBeLessThanOrEqual(30);
    await scrollTo(41 * 50_000);
    await expect(row(50_002)).toContainText('Ledger 50001');
    expect(await bodyRows.count()).toBeLessThanOrEqual(30);
    await scrollTo(0);
    await cell(2, 1).dblclick();
    const ledger = grid.getByRole('textbox', { name: 'Ledger' });
    await ledger.fill('Ledger one, renamed');
    await ledger.press('Enter');
    // Move the active cell far away, so the edited row leaves the DOM.
    await cell(2, 1).press('Control+End');
    await expect(cell(100_001, 4)).toBeFocused();
    await expect(row(2)).toHaveCount(0);
    await scrollTo(0);
    await expect(cell(2, 1)).toHaveText('Ledger one, renamed');
  });

  await test.step('an open editor keeps its draft, width, focus and the scroll position across the window', async () => {
    await cell(3, 2).dblclick();
    const owner = grid.getByRole('textbox', { name: 'Owner' });
    await expect(owner).toBeFocused();
    await owner.fill('Dee Hart');
    const width = () => owner.evaluate((node) => node.getBoundingClientRect().width);
    const before = await width();
    // The far window holds other text, so auto-sized columns change width.
    // WebKit scrolls back to a focused field's caret when the field resizes.
    await scrollTo(41 * 80_000);
    await expect(row(80_002)).toBeAttached();
    expect(await width()).toBe(before);
    expect(await area.evaluate((element) => element.scrollTop)).toBe(41 * 80_000);
    await expect(owner).toHaveValue('Dee Hart');
    await scrollTo(0);
    await expect(owner).toBeFocused();
    await owner.press('Enter');
    await expect(cell(3, 2)).toHaveText('Dee Hart');
  });

  await test.step('Ctrl+End, Page Up/Down and Ctrl+Home keep the focused cell on screen', async () => {
    await cell(2, 1).click();
    await page.keyboard.press('Control+End');
    const last = cell(100_001, 4);
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await page.keyboard.press('PageUp');
    const focusedRow = await page.evaluate(() =>
      Number(document.activeElement?.closest('tr')?.getAttribute('aria-rowindex'))
    );
    expect(focusedRow).toBeLessThan(100_001);
    expect(focusedRow).toBeGreaterThan(99_980);
    expect(await focusedOnTop(page), 'focused cell under the sticky header').toBe(true);
    await page.keyboard.press('PageDown');
    await expect(last).toBeFocused();
    await last.press('Control+Home');
    await expect(grid.locator('thead [aria-colindex="1"] button')).toBeFocused();
    await expect(row(2)).toBeInViewport();
  });

  await test.step('axe passes with an editor open and while windowed and scrolled, light and dark', async () => {
    for (const mode of ['light', 'dark'] as const) {
      await open(page, 'data-grid-editing', mode);
      await page
        .getByRole('grid', { name: 'Harbor deals' })
        .getByRole('gridcell', { name: 'Harbor Notes renewal', exact: true })
        .click();
      await page.keyboard.press('Enter');
      problems.push(...(await axe(page, '[data-example="data-grid-editing"]')));
      await open(page, ID, mode);
      await scrollTo(41 * 33_333);
      await expect(row(33_335)).toBeAttached();
      await cell(33_335, 1).dblclick();
      await expect(grid.locator('[data-tx-grid-editor]')).toBeFocused();
      problems.push(...(await axe(page, `[data-example="${ID}"]`)));
    }
  });

  await test.step('P1-17: a narrow grid keeps rows on one line and reaches every cell by keyboard', async () => {
    await page.setViewportSize({ width: 412, height: 900 });
    await open(page, 'data-grid-core');
    const core = page.locator('[data-example="data-grid-core"] .tx-data-grid').first();
    const cells = core.locator('tbody tr').first().locator('td');
    await expect(cells.nth(1)).toBeVisible();
    // One line: a wrapped name was about three lines tall.
    const heights = await cells.evaluateAll((all) =>
      all.slice(1).map((td) => td.getBoundingClientRect().height)
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
    // The table scrolls inside its wrapper, not the page.
    const wrap = core.locator('.tx-table-wrap').first();
    expect(await wrap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await expectNoPageScroll(page);
    const count = await cells.count();
    await cells.nth(count - 1).click();
    for (let step = 0; step < count - 1; step += 1) {
      await page.keyboard.press('ArrowLeft');
      expect(await focusedOnTop(page), `focused cell after ${step + 1} ArrowLeft`).toBe(true);
    }
  });

  expect(problems).toEqual([]);
});

test('data calendar: opens scrolled before paint, pointer create and drag (mirrored in RTL), Alt+Arrow, phone layout, axe while moving', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const ID = 'data-calendar';
  const chip = (key: string) => page.locator(`[data-calendar-event="${key}"]`);
  const column = (date: string) => page.locator(`[data-day-column="${date}"]`);
  const selected = page.locator('.selected');
  const announcer = page.locator('[data-calendar-announcer]');
  const openCalendar = async (mode: 'light' | 'dark' = 'light') => {
    await open(page, ID, mode);
    await expect(chip('design-review')).toBeVisible();
  };
  const dragBy = async (target: Locator, dx: number, dy: number) => {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error('event chip has no box');
    const x = box.x + Math.min(12, box.width / 2);
    const y = box.y + Math.min(8, box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
    await page.mouse.move(x + dx, y + dy, { steps: 4 });
    await page.mouse.up();
  };
  const problems: string[] = [];

  await test.step('the time grid opens an hour above the now line in its first frame, unfocused', async () => {
    // Reduced motion: the grid must still open in place, with no smooth scroll.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Record the scroll position in the first animation frame (before the
    // first paint) after the grid is inserted: no later jump means no shift.
    await page.addInitScript(() => {
      const record = window as unknown as { firstScroll?: number };
      new MutationObserver((_, observer) => {
        const grid = document.querySelector('[data-time-scroller]');
        if (!grid) return;
        observer.disconnect();
        requestAnimationFrame(() => {
          record.firstScroll = grid.scrollTop;
        });
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`/?fixture=${ID}&mode=light`);
    const scroller = page.locator(`[data-example="${ID}"] [data-time-scroller]`);
    await scroller.waitFor();
    await page.waitForFunction(() => 'firstScroll' in window);
    const first = await page.evaluate(
      () => (window as unknown as { firstScroll: number }).firstScroll
    );
    // 6:50 AM Pacific (the example's fixed clock): it opens at 5:50.
    await expect(scroller).toHaveAttribute('data-open-minute', String(5 * 60 + 50));
    const expected = await scroller.evaluate(
      (element) => ((element.firstElementChild as HTMLElement).offsetHeight / 1440) * (5 * 60 + 50)
    );
    expect(Math.abs(first - expected)).toBeLessThan(2);
    await expect(page.locator('[data-now-line]')).toBeInViewport();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await test.step('a click on an empty part of a day creates an event at that time', async () => {
    await openCalendar();
    const box = await column('2026-04-16').boundingBox();
    if (!box) throw new Error('no day column');
    // 7:00 AM Pacific, inside the scroller's first screen.
    await column('2026-04-16').click({ position: { x: 8, y: (box.height / 24) * 7 + 2 } });
    await expect(selected).toHaveText('Created New event 1 (2026-04-16T14:00:00.000Z).');
  });

  await test.step('drags an event one day later and one hour down', async () => {
    await openCalendar();
    const day = await column('2026-04-15').boundingBox();
    if (!day) throw new Error('no day column');
    await dragBy(chip('design-review'), day.width, day.height / 24);
    await expect(selected).toHaveText('Moved Design review to 2026-04-16T14:00:00.000Z.');
    await expect(
      column('2026-04-16').locator('[data-calendar-event="design-review"]')
    ).toBeVisible();
    await expect(announcer).toContainText('Design review moved to Thursday, April 16, 2026');
  });

  await test.step('mirrors the drag direction in RTL', async () => {
    await openCalendar();
    await page.getByLabel('Calendar direction').selectOption('rtl');
    const day = await column('2026-04-15').boundingBox();
    if (!day) throw new Error('no day column');
    // Dragging toward the inline end (left in RTL) is one day later.
    await dragBy(chip('design-review'), -day.width, 0);
    await expect(selected).toHaveText('Moved Design review to 2026-04-16T13:00:00.000Z.');
  });

  await test.step('Alt+Arrow moves the event and never navigates back', async () => {
    await page.goto('about:blank');
    await openCalendar();
    const url = page.url();
    const event = chip('design-review');
    await event.focus();
    // Alt+Left is the browser's Back shortcut on Windows and Linux: the calendar takes it.
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(selected).toHaveText('Moved Design review to 2026-04-14T13:00:00.000Z.');
    expect(page.url()).toBe(url);
    await expect(event).toBeFocused();
  });

  await test.step('axe passes with an event grabbed and with the Move menu open, light and dark', async () => {
    for (const mode of ['light', 'dark'] as const) {
      await openCalendar(mode);
      await chip('design-review').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
      await expect(chip('design-review')).toHaveAttribute('aria-pressed', 'true');
      problems.push(...(await axe(page, `[data-example="${ID}"]`)));
      await page.keyboard.press('Escape');
      await chip('design-review').focus();
      await page.keyboard.press('Control+ArrowRight');
      await expect(announcer).not.toBeEmpty();
      await page.keyboard.press('Shift+F10');
      await expect(page.getByRole('menu', { name: 'Move Design review to…' })).toBeVisible();
      problems.push(...(await axe(page, `[data-example="${ID}"]`, '[data-calendar-move-menu]')));
    }
  });

  await test.step('P1-16: event tones render from tokens', async () => {
    await openCalendar();
    const tones = await Promise.all(
      ['primary', 'success'].map((tone) =>
        page
          .locator(`.tx-calendar__event[data-tone="${tone}"]`)
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundColor)
      )
    );
    expect(tones[0]).not.toBe(tones[1]);
  });

  await test.step('P1-16: on a phone the day headings scroll with their columns', async () => {
    await page.setViewportSize({ width: 412, height: 900 });
    await openCalendar();
    const host = page.locator(`[data-example-host="${ID}"]`);
    await expectNoPageScroll(page);
    await host.locator('[data-time-view]').evaluate((element) => {
      element.scrollLeft = 200;
    });
    const offsets = await host.evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('[data-day-column]')].map((day) => {
        const heading = root.querySelector(
          `.tx-calendar__day-heading[data-calendar-date="${day.dataset.dayColumn}"]`
        );
        return Math.abs(
          day.getBoundingClientRect().left - (heading?.getBoundingClientRect().left ?? Number.NaN)
        );
      })
    );
    expect(offsets.length).toBe(7);
    for (const offset of offsets) expect(offset).toBeLessThan(1.5);
    // Each day keeps a readable column instead of seven slivers.
    expect(await column('2026-04-12').evaluate((c) => c.clientWidth)).toBeGreaterThanOrEqual(80);
  });

  expect(problems).toEqual([]);
});

test('data board and virtual list: the lazy move menu relocates a card; the active row is marked in forced colors', async ({
  page,
}) => {
  await test.step('the board move menu loads lazily, moves a card and stays axe-clean', async () => {
    const example = page.locator('[data-example="data-board"]');
    await page.goto('/?fixture=data-board&mode=light', { waitUntil: 'networkidle' });
    const board = example.locator('.tx-board').first();
    await expect(board).toBeVisible({ timeout: 20_000 });
    const card = board.locator('[data-item-id="task-1"]');
    await card.locator('[data-board-move-menu]').click();
    await expect(example.locator('[data-board-move-menu-chunk]')).toBeAttached({
      timeout: 15_000,
    });
    // The lazy chunk replaces the light triggers; open again if the first click only loaded.
    const menuItem = page.getByRole('menuitem', { name: 'Done — top' });
    if (!(await menuItem.isVisible().catch(() => false))) {
      await board.locator('[data-item-id="task-1"] [data-board-move-menu]').click();
    }
    await expect(menuItem).toBeVisible({ timeout: 10_000 });
    await menuItem.click();
    await expect(board.locator('[data-board-cell][aria-label="Done"]')).toContainText(
      'Map the core flow'
    );
    await expect(board.locator('.tx-board__status')).toContainText(
      'Moved Map the core flow to Done'
    );
    expect(await axe(page, '[data-example="data-board"]')).toEqual([]);
  });

  await test.step('P1-18: the active virtual-list row is marked, forced colors included', async () => {
    for (const forced of [false, true]) {
      await page.emulateMedia({ forcedColors: forced ? 'active' : 'none' });
      await page.goto('/?fixture=data-virtual-list&mode=light');
      const host = page.locator('[data-example-host="data-virtual-list"]');
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
});
