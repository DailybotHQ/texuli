import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * `@texuli/pages/paged` in a real browser (fixture page `pages-print.html`):
 * the paged view lays a fictional report onto real pages measured in the
 * DOM, the screen shows exactly the model's pages, print isolates the view
 * (the fixture's heading does not print), Chromium's `page.pdf()` prints
 * one PDF page per model page at the page size, and axe passes in light,
 * dark and forced colors.
 */

declare global {
  interface Window {
    txPaged: { pages: () => number; pageOf: (id: string) => number; split: () => boolean };
  }
}

async function open(page: Page, query = '') {
  await page.goto(`/pages-print.html${query}`);
  await expect(page.locator('#paged-status')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.tx-pages-paged')).toHaveAttribute('data-paged-ready', 'true', {
    timeout: 30_000,
  });
  // Fonts settle and trigger one more layout; wait until the page count is stable.
  let previous = -1;
  await expect
    .poll(async () => {
      const count = await page.evaluate(() => window.txPaged.pages());
      const stable = count === previous && count > 0;
      previous = count;
      return stable;
    })
    .toBe(true);
  return page.evaluate(() => window.txPaged.pages());
}

/** Page boxes (width, height in points) from the PDF page dictionaries. */
function pageBoxes(bytes: Buffer): [number, number][] {
  const source = bytes.toString('latin1');
  return [
    ...source.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/gu),
  ].map((match) => [Number(match[3]) - Number(match[1]), Number(match[4]) - Number(match[2])]);
}

test.describe('pages paged view and print', () => {
  test('shows the model pages with headers, footers, breaks and inert continuations', async ({
    page,
  }) => {
    const count = await open(page);
    expect(count).toBeGreaterThan(2);
    const sheets = page.getByRole('group', { name: /^Page \d+ of \d+$/ });
    await expect(sheets).toHaveCount(count);
    await expect(sheets.first()).toHaveAccessibleName(`Page 1 of ${count}`);
    await expect(sheets.first().locator('[data-band="footer"]')).toHaveText(`Page 1 of ${count}`);
    await expect(sheets.first().locator('[data-band="header"]')).toContainText(
      'Quarterly field report'
    );
    // The explicit break puts the appendix at the top of its own page.
    const appendix = await page.evaluate(() => window.txPaged.pageOf('note'));
    await expect(
      sheets
        .nth(appendix - 1)
        .locator('.tx-pages-paged__slice')
        .first()
    ).toHaveAttribute('data-block-id', 'note');
    // A paragraph that splits across pages continues in an inert copy; its first part is not inert.
    expect(await page.evaluate(() => window.txPaged.split())).toBe(true);
    const parts = page.locator('.tx-pages-paged__slice[data-block-id="long"]');
    expect(await parts.count()).toBeGreaterThan(1);
    await expect(parts.first()).toHaveJSProperty('inert', false);
    await expect(parts.nth(1)).toHaveJSProperty('inert', true);
    await expect(parts.nth(1)).toHaveAttribute('data-continued', 'true');
    // Every block's slices stay inside its page body.
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.tx-pages-paged__body')].some(
        (body) =>
          [...body.querySelectorAll<HTMLElement>(':scope > .tx-pages-paged__slice')].reduce(
            (bottom, slice) => Math.max(bottom, slice.offsetTop + slice.offsetHeight),
            0
          ) >
          body.clientHeight + 1
      )
    );
    expect(overflow).toBe(false);
  });

  test('prints one PDF page per model page at the page size, isolated to the view', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'page.pdf() is Chromium only.');
    test.setTimeout(90_000);
    for (const [size, box] of [
      ['a4', [595.28, 841.89]],
      ['letter', [612, 792]],
    ] as const) {
      await test.step(size, async () => {
        const count = await open(page, size === 'letter' ? '?size=letter' : '');
        await page.emulateMedia({ media: 'print' });
        await expect(page.getByRole('heading', { name: 'Paged view', level: 1 })).toBeHidden();
        await expect(page.locator('#paged-note')).toBeHidden();
        await expect(page.locator('.tx-pages-paged__page').first()).toBeVisible();
        expect(
          await page
            .locator('.tx-pages-paged__page')
            .first()
            .evaluate((element) => getComputedStyle(element).breakAfter)
        ).toBe('page');
        // Printing keeps the layout (the measuring copy is hidden in print).
        expect(await page.evaluate(() => window.txPaged.pages())).toBe(count);
        await page.emulateMedia({ media: null });
        const boxes = pageBoxes(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
        expect(boxes).toHaveLength(count);
        for (const [width, height] of boxes) {
          expect(width).toBeCloseTo(box[0], 0);
          expect(height).toBeCloseTo(box[1], 0);
        }
      });
    }
  });

  for (const mode of ['light', 'dark', 'forced colors'] as const) {
    test(`passes axe (${mode})`, async ({ page }) => {
      if (mode === 'forced colors') await page.emulateMedia({ forcedColors: 'active' });
      await open(page, mode === 'dark' ? '?mode=dark' : '');
      const results = await new AxeBuilder({ page })
        .include('#paged')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
        )
      ).toEqual([]);
    });
  }
});
