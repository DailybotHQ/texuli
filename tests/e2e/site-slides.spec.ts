import { expect, type Page, test } from '@playwright/test';
import { axeViolations, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /slides-page/ (PLAN_008 T-site-slides), in the browser, one page
 * session per test:
 *
 * 1. the flagship deck on the v2 stage: keyboard steps and slides with the
 *    URL hash following, a deep link, the help dialog, overview and
 *    blackout; the layout gallery's jump list; components on slides; axe in
 *    light and dark; no request leaves the origin;
 * 2. the live editors: the JSON seed paints, invalid JSON is refused with a
 *    located diagnostic and the preview cleared, a Markdown deck typed into
 *    the other tab paints; axe.
 *
 * Copy, data and the decks themselves are unit-tested in
 * apps/website/tests/site-slides*.test.ts.
 */

const origin = serveDist();

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

/** Waits until the island holding `selector` has hydrated (Astro drops `ssr`). */
async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

const activeSlide = (page: Page, scope = '[data-slides-flagship]') =>
  page.locator(`${scope} [data-tx-deck-active="true"]`);

test('the flagship deck presents, routes, opens its layers; galleries and components paint; axe clean', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/slides-page/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Decks from JSON or Markdown, on one stage'
  );
  await hydrated(page, '[data-slides-flagship]');
  await expect(activeSlide(page)).toHaveAttribute('data-slide-id', 'texuli-01');

  // Keyboard from the slide: the hash follows the slide and step.
  await activeSlide(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(activeSlide(page)).toHaveAttribute('data-slide-id', 'texuli-02');
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/texuli-02/0');

  // Layers: help, overview, blackout; Escape closes each.
  await activeSlide(page).focus();
  await page.keyboard.press('?');
  const help = page.locator('[data-slides-flagship] [data-tx-deck-help]');
  await expect(help).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await activeSlide(page).focus();
  await page.keyboard.press('b');
  await expect(
    page.locator('[data-slides-flagship] [data-tx-deck-blackout]').first()
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-slides-flagship] [data-tx-deck-blackout]')).toHaveCount(0);

  // A deep link opens the same place.
  await page.goto(`${origin()}/slides-page/#/texuli-11/0`);
  await settle(page);
  await hydrated(page, '[data-slides-flagship]');
  await expect(activeSlide(page)).toHaveAttribute('data-slide-id', 'texuli-11');
  await expect(activeSlide(page)).toContainText('87%');

  // The layout gallery's jump list moves its own stage (never the hash).
  await hydrated(page, '[data-slides-gallery="layouts"]');
  const quote = page.locator('[data-slides-gallery-item="layout-quote"]');
  await expect(quote).toBeEnabled({ timeout: 20_000 });
  await quote.click();
  await expect(quote).toHaveAttribute('aria-current', 'true');
  await expect(activeSlide(page, '[data-slides-gallery="layouts"]')).toHaveAttribute(
    'data-slide-id',
    'layout-quote'
  );
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/texuli-11/0');

  // Components on slides: the data grid paints through the player.
  await hydrated(page, '[data-slides-gallery="components"]');
  const grid = page.locator('[data-slides-gallery-item="grid"]');
  await expect(grid).toBeEnabled({ timeout: 20_000 });
  // Await each real step (the jump, the slide, then the player's lazily
  // loaded grid painter) instead of one wait over all three: under parallel
  // load the paint is what takes time, and a lost jump fails here, not later.
  await grid.click();
  await expect(grid).toHaveAttribute('aria-current', 'true');
  const componentSlide = activeSlide(page, '[data-slides-gallery="components"]');
  await expect(componentSlide).toHaveAttribute('data-slide-id', 'grid');
  await expect(componentSlide.locator('[data-tx-player-skeleton]')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(componentSlide.getByRole('grid').first()).toBeVisible({ timeout: 20_000 });
  await hydrated(page, '[data-slides-gallery="backgrounds"]');

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running')
    );
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  expect(foreign).toEqual([]);
});

test('the live editors paint JSON and Markdown and refuse an invalid deck with its location', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/slides-page/#editor`);
  await settle(page);
  await hydrated(page, '[data-deck-editor]');
  const status = page.locator('[data-deck-editor-status]');
  await expect(status).toHaveAttribute('data-phase', 'painted', { timeout: 20_000 });

  // Invalid JSON: refused, located, and the preview cleared.
  const json = page.locator('[data-deck-editor-input="json"]');
  await json.fill('{ "formatVersion": 2, "slides": [ }');
  await expect(status).toHaveAttribute('data-phase', 'refused', { timeout: 10_000 });
  await expect(page.locator('[data-deck-editor-diagnostics] li[data-line]').first()).toBeVisible();
  await expect(page.locator('[data-deck-editor-cleared]')).toBeVisible();

  // A Markdown deck typed into the other tab paints.
  await page.locator('[data-deck-editor-tab="markdown"]').click();
  await expect(page.locator('[data-deck-editor-tab="markdown"]')).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page
    .locator('[data-deck-editor-input="markdown"]')
    .fill('---\ntitle: Typed deck\n---\n\n# Hello from Markdown\n\nTyped in the browser.\n');
  await expect(status).toHaveAttribute('data-phase', 'painted', { timeout: 10_000 });
  await expect(page.locator('[data-deck-editor-preview]')).toContainText('Hello from Markdown');
  expect(await axeViolations(page)).toEqual([]);
  expect(foreign).toEqual([]);
});
