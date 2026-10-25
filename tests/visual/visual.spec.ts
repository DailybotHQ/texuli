import { expect, type Page, test } from '@playwright/test';
import { listExamples } from '../fixtures/app/src/examples.ts';
import {
  BUILT_IN_FIXTURES,
  COLOR_SCHEMES,
  type ColorScheme,
  NARROW_FIXTURE_IDS,
  screenshotName,
  VISUAL_PROJECTS,
  type VisualTarget,
  visualTargets,
} from './visual-lib.ts';

/**
 * Visual regression (Task 4 of PLAN_001_texuli_master): every registered
 * example (`@texuli/examples`), in light and dark, on desktop Chromium and the
 * Pixel 7, diffed against the committed baselines in `visual.spec.ts-snapshots/`.
 * Run it with `pnpm visual` (summary of changed examples) or
 * `pnpm visual:update` (accept the new captures). One test per example and
 * color scheme, so a failure names the example.
 *
 * Stable captures: reduced motion, the emulated color scheme checked, fonts
 * loaded, animations, transitions and the caret frozen, a strict pixel diff.
 * Baselines are per project and per platform (Playwright adds both to the file
 * name), because system fonts differ between machines.
 */

const TARGETS = visualTargets(listExamples());

/** How long an example's lazy module may take to arrive (readiness, not speed). */
const LOAD_TIMEOUT = 20_000;

/** How long Playwright may wait for a stable capture (two identical frames). */
const SCREENSHOT_TIMEOUT = 30_000;

test.use({ reducedMotion: 'reduce' });

/** CSS that removes every source of motion a screenshot could catch mid-way. */
const FREEZE = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}`;

async function capture(page: Page, target: VisualTarget, scheme: ColorScheme): Promise<void> {
  await page.goto(target.path);
  // The capture is only as good as the emulation: the page must see the scheme.
  expect(
    await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches),
    `${target.id}: prefers-color-scheme is ${scheme}`
  ).toBe(scheme === 'dark');
  const host = page.locator(target.host);
  await expect(host, `${target.id} renders`).toBeVisible();
  // An example's lazy module has arrived (and did not fail to load). A readiness
  // wait, not a speed check: a busy machine can take longer than the default
  // 5 s to serve a chunk the first time (the carousel examples share one).
  await expect(host.locator(':scope > p[role="status"]'), `${target.id} loads`).toHaveCount(0, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    host.locator(':scope > p[role="alert"]'),
    `${target.id} loads without error`
  ).toHaveCount(0);
  // Block chart examples load both their block renderer and chart families
  // lazily. Wait for every expected block to mount before checking that no
  // nested chart is still loading.
  const expectedBlockCharts =
    target.id === 'blocks-data' ? 2 : target.id === 'blocks-data-charts' ? 9 : 0;
  if (expectedBlockCharts) {
    await expect(host.locator('.tx-block-chart'), `${target.id} chart blocks mount`).toHaveCount(
      expectedBlockCharts,
      { timeout: LOAD_TIMEOUT }
    );
    await expect(
      host.locator('.tx-block-chart-loading'),
      `${target.id} chart families load`
    ).toHaveCount(0, { timeout: LOAD_TIMEOUT });
  }
  if (target.id === 'blocks-diagram') {
    await expect(host.locator('[data-tx-diagram]'), `${target.id} diagrams mount`).toHaveCount(4, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(
      host.locator('[data-tx-diagram-invalid]'),
      `${target.id} hostile diagram fallback mounts`
    ).toHaveCount(1, { timeout: LOAD_TIMEOUT });
  }
  // The builder's preview player paints lazily: wait for its surface and for
  // every node skeleton to resolve, so a capture never catches a loading frame.
  if (target.kind === 'fixture' && target.id.startsWith('builder')) {
    await expect(host.locator('[data-tx-builder]'), `${target.id} builder mounts`).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(
      host.locator('[data-tx-player-surface]'),
      `${target.id} preview paints`
    ).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(
      host.locator('[data-tx-player-skeleton]'),
      `${target.id} preview loads`
    ).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
  }
  const nestedLayoutHost = host.locator('[data-tx-layout-host]');
  if (await nestedLayoutHost.count()) {
    await expect(nestedLayoutHost, `${target.id} nested layout loads`).toHaveAttribute(
      'data-loading',
      'false',
      { timeout: LOAD_TIMEOUT }
    );
  }
  await page.addStyleTag({ content: FREEZE });
  // Fonts, every image decoded (or failed), then two frames, so text, media and
  // layout have settled. Without the image wait, a slow decode captures alt text.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const images = [...document.images].map((image) =>
          image.complete ? Promise.resolve() : image.decode().catch(() => undefined)
        );
        void Promise.all([document.fonts.ready, ...images]).then(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
      })
  );
}

/**
 * Astro responsive baselines (Task 19 of PLAN_004): every `astro`-tagged
 * example, at 360/768/1024/1440 CSS pixels, in light and dark, reduced
 * motion. The widths are set per test on desktop Chromium (the capture width
 * is explicit, so the mobile project would add nothing but duplicates);
 * baselines carry the width in the name (`<id>-w<width>--<scheme>.png`).
 */
const ASTRO_TARGETS = visualTargets(listExamples({ tag: 'astro' })).filter(
  (target) => target.kind === 'example'
);
const ASTRO_VIEWPORT_WIDTHS: readonly number[] = [360, 768, 1024, 1440];

/**
 * Narrow builder baselines (Task 77): the builder fixtures also at 360 CSS
 * pixels, the smallest common phone width (the Pixel 7 project covers 412).
 */
const NARROW_TARGETS = BUILT_IN_FIXTURES.filter((target) => NARROW_FIXTURE_IDS.includes(target.id));
const RESPONSIVE_SETS = [
  ...ASTRO_TARGETS.map((target) => ({ target, widths: ASTRO_VIEWPORT_WIDTHS })),
  ...NARROW_TARGETS.map((target) => ({ target, widths: [360] as readonly number[] })),
];

for (const scheme of COLOR_SCHEMES) {
  test.describe(`astro responsive, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const { target, widths } of RESPONSIVE_SETS) {
      for (const width of widths) {
        test(`${target.id} matches its ${scheme} baseline at ${String(width)}px`, async ({
          page,
        }, testInfo) => {
          test.skip(
            testInfo.project.name !== 'chromium',
            'Responsive baselines are captured on desktop Chromium at explicit widths.'
          );
          test.setTimeout(90_000);
          await page.setViewportSize({ width, height: 900 });
          await capture(page, target, scheme);
          await expect(page, `${target.id} (${scheme}, ${String(width)}px)`).toHaveScreenshot(
            `${target.id}-w${String(width)}--${scheme}.png`,
            {
              fullPage: true,
              animations: 'disabled',
              caret: 'hide',
              scale: 'css',
              timeout: SCREENSHOT_TIMEOUT,
            }
          );
        });
      }
    }
  });
}

for (const scheme of COLOR_SCHEMES) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const target of TARGETS) {
      test(`${target.id} matches its ${scheme} baseline`, async ({ page }, testInfo) => {
        test.skip(
          !VISUAL_PROJECTS.includes(testInfo.project.name),
          'Visual baselines cover desktop Chromium and the Pixel 7 only.'
        );
        // Room for the load and stable-capture waits above on a busy machine.
        test.setTimeout(90_000);
        await capture(page, target, scheme);
        await expect(page, `${target.id} (${scheme}, ${testInfo.project.name})`).toHaveScreenshot(
          screenshotName(target, scheme),
          {
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
            // Time to get two identical consecutive frames: a readiness budget
            // for a busy machine, not a tolerance. The diff stays strict.
            timeout: SCREENSHOT_TIMEOUT,
            // Strict: any pixel beyond Playwright's per-pixel color threshold
            // counts. A ratio would let a changed word on a large page through.
          }
        );
      });
    }
  });
}
