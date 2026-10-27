/**
 * Accessibility sweep: display components, data views, charts and media.
 * axe with zero exclusions on every example in light and dark (one page
 * session per half of the list); forced colors, keyboard, RTL and 400%
 * reflow on representative interactive fixtures in one more session. The
 * smoke page (unsafe link blocked) and the icon glyphs ride along. Fix
 * findings at source.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/** Display chrome examples (token AA). */
const DISPLAY_EXAMPLES = [
  'texuli-alert',
  'texuli-badge',
  'texuli-card',
  'texuli-stat',
  'texuli-table',
  'texuli-empty',
  'texuli-stepper',
  'texuli-timeline',
  'ui-avatar',
  'ui-carousel',
  'texuli-icons',
  'texuli-scroll-area',
  'texuli-tree',
] as const;

/** Data view examples (including FIX-a11y-deferred set). */
const DATA_EXAMPLES = [
  'data-grid-core',
  'data-timeline',
  'data-board',
  'data-calendar',
  'data-files',
  'data-virtual-list',
  'data-map',
  'data-tree-view',
] as const;

/** Chart family examples. */
const CHART_EXAMPLES = [
  'charts-interaction',
  'charts-cartesian',
  'charts-compact',
  'charts-part-whole',
  'charts-matrix',
] as const;

/** Media player and gallery examples. */
const MEDIA_EXAMPLES = ['media-video', 'media-audio', 'media-gallery', 'media-image'] as const;

const ALL_SWEEP = [
  ...DISPLAY_EXAMPLES,
  ...DATA_EXAMPLES,
  ...CHART_EXAMPLES,
  ...MEDIA_EXAMPLES,
] as const;

type FixtureId = (typeof ALL_SWEEP)[number];

async function gotoFixture(
  page: Page,
  id: FixtureId,
  mode: 'light' | 'dark' = 'light'
): Promise<void> {
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  await expect(page.locator(`[data-example-host="${id}"]`)).toBeVisible({ timeout: 30_000 });
  // Prefer the inner example root when present.
  const inner = page.locator(`[data-example="${id}"]`);
  if ((await inner.count()) > 0) {
    await expect(inner.first()).toBeVisible();
  }
}

/** Collects axe violations per example instead of stopping at the first one. */
async function axeProblems(page: Page, id: FixtureId, label: string): Promise<string[]> {
  const target =
    (await page.locator(`[data-example="${id}"]`).count()) > 0
      ? `[data-example="${id}"]`
      : `[data-example-host="${id}"]`;
  const results = await new AxeBuilder({ page }).include(target).analyze();
  return results.violations.map(
    (violation) =>
      `${id} (${label}) ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

/** Two halves of the list, one page session each. */
const HALVES = [
  [...DISPLAY_EXAMPLES, ...MEDIA_EXAMPLES],
  [...DATA_EXAMPLES, ...CHART_EXAMPLES],
] as const;

for (const ids of HALVES) {
  test(`${ids[0]} … ${ids.at(-1)} pass axe in light and dark`, async ({ page }) => {
    test.setTimeout(ids.length * 20_000);
    const problems: string[] = [];
    for (const id of ids) {
      for (const mode of ['light', 'dark'] as const) {
        await gotoFixture(page, id, mode);
        problems.push(...(await axeProblems(page, id, mode)));
      }
    }
    expect(problems).toEqual([]);
  });
}

/** WCAG contrast of an element's text against its own (opaque) background fill. */
async function textContrast(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('no 2d context');
      const rgb = (color: string): number[] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const luminance = (channels: number[]): number => {
        const [r = 0, g = 0, b = 0] = channels.map((value) => {
          const v = value / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const alert = element.closest('.tx-alert') ?? element;
      const fg = luminance(rgb(getComputedStyle(element).color));
      const bg = luminance(rgb(getComputedStyle(alert).backgroundColor));
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
}

/** Stable set + every FIX-a11y-deferred fixture (light and dark are swept above). */
const FORCED: FixtureId[] = [
  'texuli-badge',
  'texuli-table',
  'texuli-timeline',
  'data-grid-core',
  'data-timeline',
  'data-board',
  'data-calendar',
  'data-files',
  'data-virtual-list',
  'data-map',
  'data-tree-view',
  'charts-interaction',
  'media-gallery',
  'media-video',
];
const REFLOW: FixtureId[] = ['texuli-card', 'texuli-stat', 'charts-compact', 'media-audio'];
const RTL: FixtureId[] = ['ui-avatar', 'texuli-table', 'data-timeline', 'charts-compact'];

test('forced colors, 320px reflow, RTL, keyboard, roles and the scoped dark alert', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems: string[] = [];

  await test.step('forced colors: every listed example passes axe', async () => {
    await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
    for (const id of FORCED) {
      await gotoFixture(page, id, 'light');
      problems.push(...(await axeProblems(page, id, 'forced colors')));
    }
    await page.emulateMedia({ forcedColors: 'none' });
  });

  await test.step('RTL: every listed example passes axe with dir=rtl', async () => {
    for (const id of RTL) {
      await gotoFixture(page, id, 'light');
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      problems.push(...(await axeProblems(page, id, 'rtl')));
    }
  });

  // POLISH_AUDIT P1-02: an alert in a scoped dark section of a light page kept
  // the page's light soft fill under the section's light text (contrast 1.01).
  // axe does not flag it, so the pair is measured directly.
  await test.step('texuli-alert keeps AA body contrast in its scoped dark section', async () => {
    await gotoFixture(page, 'texuli-alert', 'light');
    await expect(page.locator('.dark-panel[data-tx-theme]')).toBeVisible();
    expect(await textContrast(page, '.dark-panel .tx-alert__text')).toBeGreaterThanOrEqual(4.5);
  });

  await test.step('the smoke page blocks an unsafe link and the icons are named or hidden', async () => {
    await page.goto('/?fixture=smoke');
    await expect(page.getByRole('heading', { name: 'Texuli fixtures' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      'https://texuli.com/docs'
    );
    await expect(page.getByRole('link', { name: 'Unsafe link' })).toHaveCount(0);
    await expect(page.locator('[data-blocked-link]')).toHaveText('Unsafe link');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await gotoFixture(page, 'texuli-icons', 'light');
    const icons = page.locator('[data-example-host="texuli-icons"]');
    await expect(icons.getByRole('img', { name: 'Information' }).first()).toBeVisible();
    await expect(icons.getByRole('img', { name: 'Favorite' }).first()).toBeVisible();
    await expect(icons.locator('svg[aria-hidden="true"]').first()).toBeVisible();
  });

  await test.step('grid, tree, scroll area, video, gallery and carousel from the keyboard', async () => {
    await gotoFixture(page, 'data-grid-core', 'light');
    const grid = page.locator('[data-example="data-grid-core"]').getByRole('grid').first();
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');

    await gotoFixture(page, 'texuli-tree', 'light');
    const tree = page
      .locator('[data-example="texuli-tree"]')
      .getByRole('tree', { name: 'Workspace pages', exact: true });
    await expect(tree.getByRole('treeitem', { name: 'Archive' })).toHaveAttribute(
      'data-disabled',
      ''
    );
    await tree.focus();
    await tree.press('ArrowDown');
    await expect(tree).toHaveAttribute('aria-activedescendant', /item-guides/);

    await gotoFixture(page, 'texuli-scroll-area', 'light');
    const scrollArea = page.locator('[data-example="texuli-scroll-area"]');
    await expect(scrollArea.getByRole('region', { name: 'Recent activity' })).toBeVisible();
    await expect(scrollArea.locator('[data-tx-scroll-area-viewport]').first()).toHaveAttribute(
      'tabindex',
      '0'
    );

    await gotoFixture(page, 'media-video', 'light');
    const play = page.locator('[data-example="media-video"]').getByRole('button').first();
    await play.focus();
    await expect(play).toBeFocused();

    await gotoFixture(page, 'media-gallery', 'light');
    await expect(
      page.locator('[data-example="media-gallery"]').getByRole('img').first()
    ).toBeVisible();

    await gotoFixture(page, 'ui-carousel', 'light');
    const carousel = page.locator(
      '[data-example="ui-carousel"], [data-example-host="ui-carousel"]'
    );
    const region = carousel
      .getByRole('region')
      .first()
      .or(carousel.locator('[data-tx-carousel]').first());
    if ((await region.count()) > 0) {
      await region.first().focus();
      await page.keyboard.press('ArrowRight');
    }
    problems.push(...(await axeProblems(page, 'ui-carousel', 'after keyboard')));

    // The chart explorer shows a tooltip while exploring: axe checks it too.
    await gotoFixture(page, 'charts-interaction', 'light');
    const host = page.locator('[data-example-host="charts-interaction"]');
    await host.getByRole('application').first().focus();
    await expect(host.locator('[data-chart-live]').first()).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    problems.push(...(await axeProblems(page, 'charts-interaction', 'exploring')));
  });

  await test.step('320px reflow: no page scroll and axe-clean', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const id of REFLOW) {
      await gotoFixture(page, id, 'light');
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      if (overflow > 1) problems.push(`${id} overflows by ${overflow}px`);
      problems.push(...(await axeProblems(page, id, '320px')));
    }
  });

  expect(problems).toEqual([]);
});
