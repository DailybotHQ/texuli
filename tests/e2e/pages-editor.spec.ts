import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * `@texuli/pages` editor in a real browser (fixture page `pages-editor.html`):
 * typing through `@texuli/editor`, the slash menu insert, keyboard and
 * pointer reorder through `@texuli/drag`, a live embed painted by the
 * player next to a refused one, and axe in light, dark and forced colors.
 */

declare global {
  interface Window {
    txPages: {
      ids: () => string[];
      doc: () => { blocks: { id: string; type: string; content?: { text?: string }[] }[] };
      log: () => number;
      navigated: () => string[];
    };
  }
}

async function open(page: Page, query = '') {
  await page.goto(`/pages-editor.html${query}`);
  await expect(page.locator('#pages-status')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('[data-sortable-item="p1"] [role="textbox"]')).toBeVisible();
}

const ids = (page: Page) => page.evaluate(() => window.txPages.ids());
const blockText = (page: Page, id: string) =>
  page.evaluate(
    (target) =>
      (window.txPages.doc().blocks.find((block) => block.id === target)?.content ?? [])
        .map((part) => part.text ?? '\n')
        .join(''),
    id
  );
const surface = (page: Page, id: string) =>
  page.locator(`[data-sortable-item="${id}"] [role="textbox"]`).first();
const handle = (page: Page, id: string) =>
  page.locator(`[data-sortable-item="${id}"] > .tx-pages-row__gutter .tx-pages-row__handle`);

/** Put the caret at the end of a text row. */
async function caretAtEnd(page: Page, id: string) {
  await surface(page, id).click();
  await page.keyboard.press('End');
}

test.describe('pages editor', () => {
  test('types into a text row and records the edit in the op log', async ({ page }) => {
    await open(page);
    await caretAtEnd(page, 'p1');
    await page.keyboard.type(' typed');
    await expect.poll(() => blockText(page, 'p1')).toBe('Alpha paragraph typed');
    expect(await page.evaluate(() => window.txPages.log())).toBeGreaterThan(0);
    // Enter splits into a new row that takes the caret.
    await page.keyboard.press('Enter');
    await page.keyboard.type('Gamma');
    await expect.poll(async () => (await ids(page)).length).toBe(11);
    const order = await ids(page);
    expect(order[1]).toBe('p1');
    await expect.poll(() => blockText(page, order[2] as string)).toBe('Gamma');
    // Undo through the document op log.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => blockText(page, order[2] as string)).toBe('');
  });

  test('inserts a block from the slash menu, filtering as you type', async ({ page }) => {
    await open(page);
    await surface(page, 'p3').click();
    await page.keyboard.type('/');
    const combobox = page.getByRole('combobox', { name: 'Insert block' });
    await expect(combobox).toBeFocused();
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.type('quo');
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('option').first()).toContainText('Quote');
    await expect(combobox).toHaveAttribute('aria-activedescendant', /.+/);
    await page.keyboard.press('Enter');
    await expect(combobox).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.txPages.doc().blocks.map((b) => b.type)[3]))
      .toBe('quote');
    // The caret moved into the new quote.
    const quoteId = (await ids(page))[3] as string;
    await expect(surface(page, quoteId)).toBeFocused();
    await page.keyboard.type('Quoted');
    await expect(surface(page, quoteId)).toContainText('Quoted');
    // Escape closes the menu and returns to the text.
    await caretAtEnd(page, 'co1p');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await expect(combobox).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(combobox).toHaveCount(0);
  });

  test('reorders blocks by keyboard: Alt+Arrow from the text and pick up on the handle', async ({
    page,
  }) => {
    await open(page);
    await caretAtEnd(page, 'p1');
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(async () => (await ids(page)).slice(0, 3)).toEqual(['h1', 'p2', 'p1']);
    await expect(surface(page, 'p1')).toBeFocused();
    await expect(page.locator('[data-tx-announcer], [aria-live]').first()).toBeAttached();
    // Escape selects the block; Space picks up, arrows move, Escape cancels.
    await page.keyboard.press('Escape');
    await expect(handle(page, 'p1')).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await ids(page)).slice(0, 3)).toEqual(['h1', 'p2', 'p1']);
    await handle(page, 'p1').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await ids(page)).slice(0, 3)).toEqual(['h1', 'p1', 'p2']);
  });

  test('reorders a block by pointer drag on its handle', async ({ page }) => {
    await open(page);
    const from = await handle(page, 'p2').boundingBox();
    const to = await page.locator('[data-sortable-item="p1"]').boundingBox();
    if (!from || !to) throw new Error('no boxes');
    await page.locator('[data-sortable-item="p2"]').hover();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    const targetY = to.y + 2;
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(from.x + from.width / 2, from.y + ((targetY - from.y) * step) / 10);
    }
    await page.mouse.up();
    await expect.poll(async () => (await ids(page)).slice(0, 3)).toEqual(['h1', 'p2', 'p1']);
  });

  test('paints a live embed with the player, refuses an invalid one, and opens nested pages', async ({
    page,
  }) => {
    await open(page);
    // The embed's own figure: the chart it paints is a figure of its own
    // (figure.part-whole, nested inside the embed's player).
    const chart = page.locator('[data-sortable-item="chart"] figure.tx-pages-embed');
    await expect(chart).toHaveAttribute('data-state', 'painted', { timeout: 30_000 });
    await expect(chart.locator('[data-tx-player]')).toBeVisible();
    await expect(
      chart.getByRole('figure', { name: /Tickets by channel/ }),
      'the player paints the donut inside the embed'
    ).toBeVisible({ timeout: 30_000 });
    await expect(chart).toContainText('Untrusted content');
    const bad = page.locator('[data-sortable-item="bad"] figure.tx-pages-embed');
    await expect(bad).toHaveAttribute('data-state', 'refused', { timeout: 30_000 });
    await expect(bad).toContainText('This embed was refused');
    await page.getByRole('button', { name: 'Open page Roadmap' }).click();
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('button', { name: 'Home' })
      .click();
    expect(await page.evaluate(() => window.txPages.navigated())).toEqual([
      'pages/roadmap',
      'pages/home',
    ]);
    // Columns resize by keyboard steps.
    const separator = page.getByRole('separator', { name: 'Resize columns 1 and 2' });
    await separator.focus();
    await page.keyboard.press('ArrowRight');
    await expect(separator).toHaveAttribute('aria-valuenow', '7');
  });

  for (const mode of ['light', 'dark', 'forced colors'] as const) {
    test(`passes axe with the slash menu open and embeds painted (${mode})`, async ({ page }) => {
      if (mode === 'forced colors') await page.emulateMedia({ forcedColors: 'active' });
      await open(page, mode === 'dark' ? '?mode=dark' : '');
      const chart = page.locator('[data-sortable-item="chart"] figure.tx-pages-embed');
      await expect(chart).toHaveAttribute('data-state', 'painted', { timeout: 30_000 });
      // Scan the painted chart, not the player's loading state.
      await expect(chart.getByRole('figure', { name: /Tickets by channel/ })).toBeVisible({
        timeout: 30_000,
      });
      const scan = async (label: string) => {
        // WCAG rules, as the other editor sweeps: an embedded component's own
        // heading level does not follow the document outline (best practice
        // heading-order, a known gap).
        const results = await new AxeBuilder({ page })
          .include('#pages')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        return results.violations.map(
          (v) => `${label}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
        );
      };
      const idle = await scan('idle');
      await surface(page, 'p3').click();
      await page.keyboard.type('/');
      await expect(page.getByRole('listbox')).toBeVisible();
      const menu = await scan('slash menu');
      expect([...idle, ...menu]).toEqual([]);
    });
  }
});
