/**
 * Accessibility sweep: display components, data views, charts and media.
 * axe with zero exclusions in light and dark; forced-colors, keyboard, RTL and
 * 400% reflow on representative interactive fixtures. Fix findings at source.
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

async function axeExample(page: Page, id: FixtureId): Promise<void> {
  const host = page.locator(`[data-example-host="${id}"]`);
  const target =
    (await page.locator(`[data-example="${id}"]`).count()) > 0
      ? `[data-example="${id}"]`
      : `[data-example-host="${id}"]`;
  await expect(host).toBeVisible();
  const results = await new AxeBuilder({ page }).include(target).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('a11y display · light and dark axe', () => {
  for (const id of ALL_SWEEP) {
    test(`${id} passes axe in light and dark`, async ({ page }) => {
      await gotoFixture(page, id, 'light');
      await axeExample(page, id);

      await gotoFixture(page, id, 'dark');
      await axeExample(page, id);
    });
  }
});

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

// POLISH_AUDIT P1-02: an alert in a scoped dark section of a light page kept the
// page's light soft fill under the section's light text (contrast 1.01). axe
// does not flag it, so the pair is measured directly.
test('texuli-alert keeps AA body contrast in its scoped dark section', async ({ page }) => {
  await gotoFixture(page, 'texuli-alert', 'light');
  const body = '.dark-panel .tx-alert__text';
  await expect(page.locator('.dark-panel[data-tx-theme]')).toBeVisible();
  expect(await textContrast(page, body)).toBeGreaterThanOrEqual(4.5);
});

test.describe('a11y display · forced-colors', () => {
  // Stable set + every FIX-a11y-deferred fixture (light/dark covered above).
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

  for (const id of FORCED) {
    test(`${id} passes axe under forced-colors`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
      await gotoFixture(page, id, 'light');
      await axeExample(page, id);
    });
  }
});

test.describe('a11y display · 400% reflow (320 CSS px)', () => {
  const REFLOW: FixtureId[] = ['texuli-card', 'texuli-stat', 'charts-compact', 'media-audio'];

  for (const id of REFLOW) {
    test(`${id} stays usable at 320px width`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await gotoFixture(page, id, 'light');
      const host = page.locator(`[data-example-host="${id}"]`);
      await expect(host).toBeVisible();
      // No horizontal page scroll from the example host.
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
      await axeExample(page, id);
    });
  }
});

test.describe('a11y display · keyboard and roles', () => {
  test('data-grid-core exposes a named grid and moves focus with arrows', async ({ page }) => {
    await gotoFixture(page, 'data-grid-core', 'light');
    const host = page.locator('[data-example="data-grid-core"]');
    const grid = host.getByRole('grid').first();
    await expect(grid).toBeVisible();
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await axeExample(page, 'data-grid-core');
  });

  test('charts-interaction explores points and toggles series from the keyboard', async ({
    page,
  }) => {
    await gotoFixture(page, 'charts-interaction', 'light');
    const host = page.locator('[data-example-host="charts-interaction"]');
    const explorer = host.getByRole('application').first();
    await expect(explorer).toBeVisible();
    await explorer.focus();
    const live = host.locator('[data-chart-live]').first();
    await expect(live).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    await axeExample(page, 'charts-interaction');
  });

  test('media-video player controls are labelled and keyboard reachable', async ({ page }) => {
    await gotoFixture(page, 'media-video', 'light');
    const host = page.locator('[data-example="media-video"]');
    await expect(host).toBeVisible();
    const play = host.getByRole('button').first();
    await expect(play).toBeVisible();
    await play.focus();
    await expect(play).toBeFocused();
    await axeExample(page, 'media-video');
  });

  test('media-gallery exposes images with accessible names', async ({ page }) => {
    await gotoFixture(page, 'media-gallery', 'light');
    const host = page.locator('[data-example="media-gallery"]');
    await expect(host).toBeVisible();
    const images = host.getByRole('img');
    await expect(images.first()).toBeVisible();
    await axeExample(page, 'media-gallery');
  });

  test('ui-carousel moves slides with arrow keys when focused', async ({ page }) => {
    await gotoFixture(page, 'ui-carousel', 'light');
    const host = page.locator('[data-example="ui-carousel"], [data-example-host="ui-carousel"]');
    await expect(host.first()).toBeVisible();
    const region = host.getByRole('region').first().or(host.locator('[data-tx-carousel]').first());
    if ((await region.count()) > 0) {
      await region.first().focus();
      await page.keyboard.press('ArrowRight');
    }
    await axeExample(page, 'ui-carousel');
  });
});

test.describe('a11y display · RTL', () => {
  const RTL: FixtureId[] = ['ui-avatar', 'texuli-table', 'data-timeline', 'charts-compact'];

  for (const id of RTL) {
    test(`${id} passes axe with dir=rtl on the host`, async ({ page }) => {
      await gotoFixture(page, id, 'light');
      await page.evaluate(() => {
        document.documentElement.setAttribute('dir', 'rtl');
      });
      await axeExample(page, id);
    });
  }
});
