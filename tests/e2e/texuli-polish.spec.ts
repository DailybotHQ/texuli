import { expect, type Page, test } from '@playwright/test';

/**
 * Layout regressions from the component polish audit (PLAN_005 Task 11,
 * POLISH_AUDIT.md): at phone widths and in right-to-left pages, these styled
 * components must not scroll the page sideways, leave the viewport, or detach
 * their parts. Each case names its audit finding.
 */

type Direction = 'ltr' | 'rtl';

async function openExample(page: Page, id: string, width: number, dir: Direction = 'ltr') {
  await page.setViewportSize({ width, height: 900 });
  if (dir === 'rtl') {
    // The whole page is right-to-left, as a host app would set it before mount.
    await page.addInitScript(() => {
      const apply = () => {
        if (document.documentElement) document.documentElement.dir = 'rtl';
      };
      apply();
      document.addEventListener('readystatechange', apply);
    });
  }
  await page.goto(`/?fixture=${id}&mode=light`);
  const host = page.locator(`[data-example-host="${id}"]`);
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host.locator(':scope > p[role="status"]')).toHaveCount(0, { timeout: 20_000 });
}

async function expectNoPageScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'document scroll width').toBeLessThanOrEqual(client);
}

test.describe('texuli polish · no sideways page scroll', () => {
  const cases: { id: string; finding: string; widths: number[]; dirs: Direction[] }[] = [
    { id: 'texuli-tabs-accordion', finding: 'P1-03', widths: [320, 1280], dirs: ['ltr', 'rtl'] },
    { id: 'texuli-choice', finding: 'P1-04', widths: [320], dirs: ['ltr', 'rtl'] },
    { id: 'texuli-slider', finding: 'P1-05', widths: [320], dirs: ['rtl'] },
    { id: 'ui-carousel-states', finding: 'P1-06', widths: [320], dirs: ['ltr', 'rtl'] },
    { id: 'texuli-rating', finding: 'P1-08', widths: [320], dirs: ['ltr', 'rtl'] },
    { id: 'texuli-number-pin', finding: 'P1-09', widths: [320], dirs: ['ltr', 'rtl'] },
  ];
  test('every listed example keeps the page from scrolling sideways', async ({ page }) => {
    test.setTimeout(60_000);
    for (const { id, finding, widths, dirs } of cases) {
      for (const width of widths) {
        for (const dir of dirs) {
          await test.step(`${id} (${finding}) at ${width}px ${dir}`, async () => {
            await openExample(page, id, width, dir);
            await expectNoPageScroll(page);
          });
        }
      }
    }
  });
});

test('the open hover card stays inside a 320px viewport (P1-07)', async ({ page }) => {
  await openExample(page, 'ui-popover-states', 320);
  const card = page.locator('.tx-hover-card').first();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});

test('the slider thumb sits on the end of its range in RTL (P1-05)', async ({ page }) => {
  for (const dir of ['ltr', 'rtl'] as const) {
    await openExample(page, 'texuli-slider', 480, dir);
    const slider = page.locator('.tx-slider--horizontal').first();
    const geometry = await slider.evaluate((root) => {
      const thumb = root.querySelector('.tx-slider__thumb')?.getBoundingClientRect();
      const range = root.querySelector('.tx-slider__range')?.getBoundingClientRect();
      return thumb && range
        ? {
            thumbCenter: thumb.left + thumb.width / 2,
            rangeStart: range.left,
            rangeEnd: range.right,
          }
        : null;
    });
    expect(geometry, dir).not.toBeNull();
    if (!geometry) return;
    // A single-thumb range runs from the inline start to the thumb.
    const edge = dir === 'rtl' ? geometry.rangeStart : geometry.rangeEnd;
    expect(Math.abs(geometry.thumbCenter - edge), `${dir} thumb center vs range edge`).toBeLessThan(
      1.5
    );
  }
});

test('color swatches keep their fill and show selection in forced colors (P1-10)', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openExample(page, 'texuli-tags-color', 1280);
  // One picker's presets (the example has more than one picker).
  const swatches = page
    .locator('.tx-color-picker__swatches')
    .first()
    .locator('.tx-color-picker__swatch');
  await expect(swatches.first()).toBeVisible();
  const styles = await swatches.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        pressed: element.getAttribute('aria-pressed') === 'true',
        background: style.backgroundColor,
        border: `${style.borderTopWidth} ${style.borderTopColor}`,
      };
    })
  );
  // Each preset keeps its own color instead of collapsing to the system canvas.
  expect(new Set(styles.map((style) => style.background)).size).toBe(styles.length);
  const selected = styles.filter((style) => style.pressed);
  const others = styles.filter((style) => !style.pressed);
  expect(selected.length).toBeGreaterThan(0);
  expect(others.length).toBeGreaterThan(0);
  for (const style of selected) {
    for (const other of others) expect(style.border).not.toBe(other.border);
  }
});
