import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * `@texuli/pages/collab` in a real browser (fixture page `pages-collab.html`):
 * two editors (Ada and Lin) on one in-memory sync hub converge as both type,
 * show each other's caret, comment on a selection (painted with the CSS
 * Custom Highlight API), accept a suggestion, restore a named version, and
 * pass axe in light, dark and forced colors.
 */

declare global {
  interface Window {
    txCollab: {
      doc: (i: number) => string;
      plain: (i: number, id: string) => string | null;
      threads: (i: number) => number;
      suggestions: (i: number) => number;
      versions: (i: number) => number;
      highlights: (name: string) => number;
    };
  }
}

const ADA = 0;
const LIN = 1;

async function open(page: Page, query = '') {
  await page.goto(`/pages-collab.html${query}`);
  await expect(page.locator('#pages-status')).toHaveText('Ready', { timeout: 30_000 });
  await expect(surface(page, 'ada', 'p1')).toBeVisible();
  await expect(surface(page, 'lin', 'p1')).toBeVisible();
}

const pane = (page: Page, who: 'ada' | 'lin') => page.locator(`[data-pane="${who}"]`);
const surface = (page: Page, who: 'ada' | 'lin', id: string): Locator =>
  pane(page, who).locator(`[data-sortable-item="${id}"] [role="textbox"]`).first();
const plain = (page: Page, i: number, id: string) =>
  page.evaluate(([index, target]) => window.txCollab.plain(index as number, target as string), [
    i,
    id,
  ] as const);

/**
 * Focus a row and set the DOM selection to UTF-16 offsets of its text
 * (`Home` and `End` are not reliable caret keys on every platform).
 */
async function place(page: Page, who: 'ada' | 'lin', id: string, from: number, to = from) {
  await surface(page, who, id).click();
  await page.evaluate(
    ([pane, block, start, end]) => {
      const element = document.querySelector(
        `[data-pane="${pane}"] [data-tx-block="${block}"]`
      ) as Element;
      const point = (offset: number): [Node, number] => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let count = 0;
        for (
          let node = walker.nextNode() as Text | null;
          node;
          node = walker.nextNode() as Text | null
        ) {
          if (offset <= count + node.data.length) return [node, offset - count];
          count += node.data.length;
        }
        return [element, element.childNodes.length];
      };
      const [anchor, anchorOffset] = point(start as number);
      const [focus, focusOffset] = point(end as number);
      document.getSelection()?.setBaseAndExtent(anchor, anchorOffset, focus, focusOffset);
    },
    [who, id, from, to] as const
  );
}

async function caretAtEnd(page: Page, who: 'ada' | 'lin', id: string) {
  const text = await plain(page, who === 'ada' ? ADA : LIN, id);
  await place(page, who, id, (text ?? '').length);
}

test.describe('collaborative page editor', () => {
  test('two editors converge, show each other’s caret and undo only their own edits', async ({
    page,
  }) => {
    await open(page);
    await caretAtEnd(page, 'ada', 'p1');
    await page.keyboard.type(' from Ada');
    await caretAtEnd(page, 'lin', 'p2');
    await page.keyboard.type(' from Lin');
    await expect.poll(() => plain(page, LIN, 'p1')).toBe('Alpha paragraph from Ada');
    await expect.poll(() => plain(page, ADA, 'p2')).toBe('Beta paragraph from Lin');
    // The rendered rows show the merged text too.
    await expect(pane(page, 'lin').locator('[data-sortable-item="p1"]')).toContainText('from Ada');
    await expect
      .poll(() => page.evaluate(() => window.txCollab.doc(0) === window.txCollab.doc(1)))
      .toBe(true);
    // Lin's caret is drawn over Ada's text (decorative) and Lin is listed for assistive technology.
    await expect(
      pane(page, 'ada').locator('.tx-pages-collab__caret[data-replica="lin"]')
    ).toBeVisible();
    await expect(pane(page, 'ada').locator('.tx-pages-collab__overlay')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    await expect(
      pane(page, 'ada').locator('.tx-pages-collab__person[data-replica="lin"]')
    ).toContainText('Lin');
    // Ada's undo removes Ada's edit only.
    await pane(page, 'ada').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => plain(page, LIN, 'p1')).toBe('Alpha paragraph');
    await expect.poll(() => plain(page, LIN, 'p2')).toBe('Beta paragraph from Lin');
  });

  test('Backspace right after a click deletes a character, never joins rows from a stale caret', async ({
    page,
  }) => {
    await open(page);
    for (const [who, i] of [
      ['ada', ADA],
      ['lin', LIN],
      ['ada', ADA],
    ] as const) {
      await caretAtEnd(page, who, 'p2');
      await page.keyboard.press('Backspace');
      await expect.poll(() => plain(page, i, 'p1')).toBe('Alpha paragraph');
    }
    await expect.poll(() => plain(page, ADA, 'p2')).toBe('Beta paragr');
  });

  test('comments on a selection; the peer sees the thread and the highlight', async ({ page }) => {
    await open(page);
    await place(page, 'ada', 'p1', 0, 15);
    await pane(page, 'ada').getByRole('button', { name: 'Comment', exact: true }).click();
    const composer = pane(page, 'ada').getByLabel('Comment on “Alpha paragraph”');
    await expect(composer).toBeFocused();
    await composer.fill('Rename this? @{u-lin|Lin}');
    await pane(page, 'ada').locator('.tx-pages-collab__composer button[type="submit"]').click();
    const thread = pane(page, 'lin').locator('.tx-pages-collab__thread').first();
    await expect(thread).toContainText('Ada on “Alpha paragraph”');
    await expect(thread.locator('.tx-pages-collab__mention')).toHaveText('@Lin');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.txCollab.highlights('tx-pages-comment-active') +
            window.txCollab.highlights('tx-pages-comment')
        )
      )
      .toBeGreaterThan(0);
    // Lin types before the commented text: the thread follows it.
    await place(page, 'lin', 'p1', 0);
    await page.keyboard.type('So, ');
    await expect.poll(() => plain(page, ADA, 'p1')).toBe('So, Alpha paragraph');
    const anchored = pane(page, 'ada').locator('.tx-pages-collab__thread').first();
    await expect(anchored).not.toHaveAttribute('data-orphaned', '');
    await expect(anchored).toContainText('Ada on “Alpha paragraph”');
    // Resolve from Lin's side; Ada sees it resolved.
    await thread.getByRole('button', { name: 'Resolve' }).click();
    await expect(pane(page, 'ada').locator('.tx-pages-collab__thread').first()).toHaveAttribute(
      'data-status',
      'resolved'
    );
  });

  test('suggests an edit and the peer accepts it', async ({ page }) => {
    await open(page);
    const toggle = pane(page, 'ada').getByRole('button', { name: 'Suggesting' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await caretAtEnd(page, 'ada', 'p2');
    await page.keyboard.type(' maybe');
    const suggestion = pane(page, 'lin').locator('[data-suggestion]').first();
    await expect(suggestion).toContainText('Suggestion by Ada');
    await expect(suggestion).toContainText('Insert “ maybe”');
    await expect
      .poll(() => page.evaluate(() => window.txCollab.highlights('tx-pages-suggest-insert')))
      .toBeGreaterThan(0);
    await suggestion.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.txCollab.suggestions(0))).toBe(0);
    await expect.poll(() => plain(page, ADA, 'p2')).toBe('Beta paragraph maybe');
    // Backspace while suggesting strikes text instead of deleting it, and keeps going left.
    await caretAtEnd(page, 'ada', 'p2');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    const deletion = pane(page, 'lin').locator('[data-suggestion]').first();
    await expect(deletion).toContainText('Delete “ybe”');
    expect(await plain(page, ADA, 'p2')).toBe('Beta paragraph maybe');
    expect(await plain(page, ADA, 'p1')).toBe('Alpha paragraph');
    await expect
      .poll(() => page.evaluate(() => window.txCollab.highlights('tx-pages-suggest-delete')))
      .toBeGreaterThan(0);
    await deletion.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.txCollab.suggestions(1))).toBe(0);
    await expect.poll(() => plain(page, LIN, 'p2')).toBe('Beta paragraph maybe');
    // Delete strikes forward and the caret moves past the struck text.
    await place(page, 'ada', 'p2', 0);
    await page.keyboard.press('Delete');
    await page.keyboard.press('Delete');
    await page.keyboard.type('Z');
    await expect.poll(() => plain(page, LIN, 'p2')).toBe('BeZta paragraph maybe');
    await expect(pane(page, 'lin').locator('[data-suggestion]')).toHaveCount(2);
    await expect(pane(page, 'lin').locator('[data-suggestion]').first()).toContainText(
      'Delete “Be”'
    );
    await expect(pane(page, 'lin').locator('[data-suggestion]').last()).toContainText('Insert “Z”');
  });

  test('saves a named version and restores it for both editors', async ({ page }) => {
    await open(page);
    const history = pane(page, 'ada').getByRole('button', { name: 'Version history' });
    await history.click();
    await expect(history).toHaveAttribute('aria-expanded', 'true');
    await pane(page, 'ada').getByLabel('Version name').fill('Clean draft');
    await pane(page, 'ada').getByRole('button', { name: 'Save version' }).click();
    await expect.poll(() => page.evaluate(() => window.txCollab.versions(1))).toBe(1);
    await caretAtEnd(page, 'lin', 'p1');
    await page.keyboard.type(' (edited)');
    await expect.poll(() => plain(page, ADA, 'p1')).toBe('Alpha paragraph (edited)');
    await pane(page, 'ada')
      .getByRole('button', { name: /Changes since/ })
      .click();
    await expect(pane(page, 'ada').locator('.tx-pages-collab__diff')).toContainText(
      'Alpha paragraph (edited)'
    );
    await pane(page, 'ada').getByRole('button', { name: 'Restore “Clean draft”' }).click();
    await expect.poll(() => plain(page, LIN, 'p1')).toBe('Alpha paragraph');
    await expect(pane(page, 'lin').locator('[data-sortable-item="p1"]')).not.toContainText(
      '(edited)'
    );
  });

  for (const mode of ['light', 'dark', 'forced colors'] as const) {
    test(`passes axe with a comment, a suggestion and the history open (${mode})`, async ({
      page,
    }) => {
      if (mode === 'forced colors') await page.emulateMedia({ forcedColors: 'active' });
      await open(page, mode === 'dark' ? '?mode=dark' : '');
      await place(page, 'ada', 'p1', 0, 15);
      await pane(page, 'ada').getByRole('button', { name: 'Comment', exact: true }).click();
      await pane(page, 'ada').getByLabel('Comment on “Alpha paragraph”').fill('Looks good');
      await pane(page, 'ada').locator('.tx-pages-collab__composer button[type="submit"]').click();
      await pane(page, 'lin').getByRole('button', { name: 'Suggesting' }).click();
      await caretAtEnd(page, 'lin', 'p2');
      await page.keyboard.type(' too');
      await pane(page, 'ada').getByRole('button', { name: 'Version history' }).click();
      await expect(pane(page, 'ada').locator('[data-suggestion]')).toHaveCount(1);
      await expect(pane(page, 'lin').locator('.tx-pages-collab__thread')).toHaveCount(1);
      const results = await new AxeBuilder({ page })
        .include('#pages')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
        )
      ).toEqual([]);
    });
  }
});
