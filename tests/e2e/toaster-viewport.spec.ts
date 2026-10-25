import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * FIX-toaster-viewport: the styled Toaster's viewport is a manual popover in
 * the top layer. It must place itself by logical insets (no popover UA box),
 * stack toasts with a gap, move in and out (not under reduced motion), stay
 * reachable under a modal (R16) and pass axe with zero exclusions in light,
 * dark and forced colors.
 */

const ID = 'texuli-toaster-positions';
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
];

async function open(page: Page, mode: 'light' | 'dark', forced = false): Promise<void> {
  await page.emulateMedia({
    colorScheme: mode,
    forcedColors: forced ? 'active' : 'none',
    reducedMotion: 'reduce',
  });
  await page.goto(`/?fixture=${ID}&mode=${mode}`);
  await expect(page.locator(`[data-example="${ID}"]`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-tx-toast-root]')).toHaveCount(8);
}

const region = (page: Page, name: string) => page.getByRole('region', { name });

for (const [label, mode, forced] of [
  ['light', 'light', false],
  ['dark', 'dark', false],
  ['forced colors', 'light', true],
] as const) {
  test(`toasts in every tone pass axe with zero exclusions, ${label}`, async ({ page }) => {
    await open(page, mode, forced);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
      )
    ).toEqual([]);
  });
}

test('the viewport drops the popover UA box and pins to its logical edges', async ({
  page,
  isMobile,
}) => {
  await open(page, 'light');
  const top = region(page, 'Account notifications');
  const bottom = region(page, 'System notifications');
  for (const viewport of [top, bottom]) {
    const style = await viewport.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        margin: css.marginBlockStart,
        border: css.borderTopWidth,
        background: css.backgroundColor,
      };
    });
    expect(style).toEqual({ margin: '0px', border: '0px', background: 'rgba(0, 0, 0, 0)' });
  }
  const size = page.viewportSize() ?? { width: 0, height: 0 };
  const topBox = await top.locator('[data-tx-toast-list]').boundingBox();
  const bottomBox = await bottom.locator('[data-tx-toast-list]').boundingBox();
  if (!topBox || !bottomBox) throw new Error('toast lists not rendered');
  // Block edges: the top stack at the top, the bottom stack at the bottom.
  expect(topBox.y).toBeLessThan(40);
  expect(size.height - (bottomBox.y + bottomBox.height)).toBeLessThan(40);
  if (isMobile) {
    // Narrow screens center both stacks.
    expect(Math.abs(topBox.x + topBox.width / 2 - size.width / 2)).toBeLessThan(4);
    return;
  }
  // Inline edges in LTR: top-end on the right, bottom-start on the left.
  expect(size.width - (topBox.x + topBox.width)).toBeLessThan(40);
  expect(bottomBox.x).toBeLessThan(40);
  // Toasts stack with a gap, never overlapping.
  const cards = await top
    .locator('[data-tx-toast-root]')
    .evaluateAll((items) =>
      items
        .map((item) => item.getBoundingClientRect())
        .map((r) => ({ top: r.top, bottom: r.bottom }))
    );
  for (let index = 1; index < cards.length; index += 1) {
    expect((cards[index]?.top ?? 0) - (cards[index - 1]?.bottom ?? 0)).toBeGreaterThanOrEqual(4);
  }
  // RTL: start and end flip.
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  const topRtl = await top.locator('[data-tx-toast-list]').boundingBox();
  const bottomRtl = await bottom.locator('[data-tx-toast-list]').boundingBox();
  if (!topRtl || !bottomRtl) throw new Error('toast lists not rendered');
  expect(topRtl.x).toBeLessThan(40);
  expect(size.width - (bottomRtl.x + bottomRtl.width)).toBeLessThan(40);
});

test('a dismissed toast moves out, then leaves the DOM', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/?fixture=${ID}&mode=light`);
  await expect(page.locator('[data-tx-toast-root]')).toHaveCount(8);
  const top = region(page, 'Account notifications');
  // The exit lasts 160 ms: record it as it happens instead of racing it.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __leaving: string[] }).__leaving = seen;
    new MutationObserver((records) => {
      for (const record of records) {
        const node = record.target as Element;
        if (node.getAttribute?.('data-leaving') === 'true') {
          seen.push(`${node.hasAttribute('inert')}|${getComputedStyle(node).animationName}`);
        }
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-leaving'],
    });
  });
  await top.getByRole('button', { name: /Profile saved/ }).click();
  await expect(top.locator('[data-tx-toast-root]')).toHaveCount(3);
  const seen = await page.evaluate(() => (window as unknown as { __leaving: string[] }).__leaving);
  expect(seen).toContain('true|tx-toast-out');
});

test('with reduced motion a dismissed toast leaves at once', async ({ page }) => {
  await open(page, 'light');
  const top = region(page, 'Account notifications');
  await top.getByRole('button', { name: /Profile saved/ }).click();
  await expect(top.locator('[data-tx-toast-root]')).toHaveCount(3);
  await expect(top.locator('[data-leaving]')).toHaveCount(0);
});

test('the region stays reachable under a modal dialog (R16)', async ({ page }) => {
  await open(page, 'light');
  await page.getByRole('button', { name: 'Open a dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit crew roster' })).toBeVisible();
  // F6 reaches the notifications; a dismiss control there still works.
  await page.keyboard.press('F6');
  const focusedInRegion = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-tx-toast-viewport]'))
  );
  expect(focusedInRegion).toBe(true);
  // The dialog is aria-modal, so role queries treat the page behind it as
  // hidden; reach the region by its markup to check the pointer path.
  const top = page.locator('[data-tx-toast-viewport][aria-label="Account notifications"]');
  await top.locator('button[aria-label$="Invite accepted"]').click();
  await expect(top.locator('[data-tx-toast-root]')).toHaveCount(3);
  await expect(page.getByRole('dialog', { name: 'Edit crew roster' })).toBeVisible();
});
