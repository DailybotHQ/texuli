import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /motion-page/ (PLAN_010 T-site-060), in the browser, one page
 * session per test:
 *
 * 1. the settings panel drives every demo: overlays, the list, shared
 *    elements, the timeline, springs and tokens play through the Web
 *    Animations API at full motion, and start no animation at all under the
 *    reduced-motion override (a counter wraps `Element.prototype.animate`);
 *    focus returns from overlays; axe in light and dark;
 * 2. the player paints the motion blueprint (cards enter on the blueprint's
 *    own toggle) and refuses the hostile motion with its diagnostic;
 * 3. at 360 px nothing overflows and the controls work from the keyboard.
 *
 * Copy, data and the blueprints are unit-tested in
 * apps/website/tests/site-motion.test.ts.
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

/** Counts every Web Animations start on the page. */
async function countAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as { __txAnimations: number };
    target.__txAnimations = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      target.__txAnimations += 1;
      return original.apply(this, args);
    };
  });
}
const animations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __txAnimations: number }).__txAnimations);

/** Waits until the island that holds `selector` has hydrated (Astro drops `ssr`). */
async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function setReduced(page: Page, on: boolean): Promise<void> {
  const box = page.getByRole('checkbox', { name: 'Reduced motion' });
  if (on) await box.check();
  else await box.uncheck();
}

const outcome = (page: Page, name: string) => page.locator(`[data-motion-outcome="${name}"]`);

/** Waits until no animation or transition runs (after a style change has had two frames to start them). */
async function quiet(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
  await page.waitForFunction(
    () => document.getAnimations().every((animation) => animation.playState !== 'running'),
    undefined,
    { polling: 100 }
  );
}

test('the settings drive every demo: full motion animates, reduced motion starts nothing', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const foreign = watchForeign(page);
  await countAnimations(page);
  await page.goto(`${origin()}/motion-page/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Motion that respects the reader'
  );
  await expect(page.getByText('in development · ships in 0.6.0')).toBeVisible();

  // Settings: the level rescales the duration tokens; the sample plays.
  await hydrated(page, '[data-motion-console]');
  const base = page.locator('[data-motion-duration="base"]');
  await expect(base).toHaveText('200 ms');
  await page.getByRole('radio', { name: 'Subtle' }).check();
  await expect(base).toHaveText('120 ms');
  await page.getByRole('radio', { name: 'Full' }).check();
  await page.getByRole('button', { name: 'Play sample' }).click();
  await expect(outcome(page, 'console')).toHaveText('Played: finished');

  // Presence: the dialog animates in and out; focus returns to its trigger.
  await hydrated(page, '[data-motion-presence]');
  let before = await animations(page);
  const openDialog = page.getByRole('button', { name: 'Open dialog' });
  await openDialog.click();
  const dialog = page.getByRole('dialog', { name: 'Edit the release crew' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => animations(page)).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(openDialog).toBeFocused();

  // The list glides (FLIP) at full motion.
  await hydrated(page, '[data-motion-layout]');
  before = await animations(page);
  await page.getByRole('button', { name: 'Move Write launch notes down' }).click();
  await expect(page.locator('[data-motion-list-status]')).toHaveText(
    'Write launch notes moved to position 2 of 4.'
  );
  await expect.poll(() => animations(page)).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Move Write launch notes down' })).toBeFocused();

  // Shared element, timeline, springs and tokens play.
  await hydrated(page, '[data-motion-shared]');
  await page.getByRole('button', { name: 'Open Harbor Notes' }).click();
  await expect(page.getByRole('button', { name: 'Back to all projects' })).toBeFocused();
  await expect(outcome(page, 'shared')).toHaveText('Played: finished');
  await page.getByRole('button', { name: 'Back to all projects' }).click();
  await expect(page.getByRole('button', { name: 'Open Harbor Notes' })).toBeFocused();

  await hydrated(page, '[data-motion-timeline]');
  await page
    .getByRole('toolbar', { name: 'Timeline' })
    .getByRole('button', { name: 'Play' })
    .click();
  await expect(outcome(page, 'timeline')).toHaveText('Played: finished', { timeout: 10_000 });

  await hydrated(page, '[data-motion-springs]');
  await page.getByRole('button', { name: 'Play bouncy' }).click();
  await expect(outcome(page, 'springs')).toHaveText('bouncy: Played: finished');

  await hydrated(page, '[data-motion-tokens]');
  await page.getByRole('tab', { name: 'Easings' }).click();
  await page.getByRole('button', { name: 'Play emphasized' }).click();
  await expect(page.locator('[data-motion-token-playing]')).toHaveText(
    'Easing emphasized over 500 ms'
  );
  await expect(outcome(page, 'tokens')).toHaveText('Played: finished');

  // Reduced motion: the same actions commit at once and start no animation.
  await page.locator('#settings').scrollIntoViewIfNeeded();
  await setReduced(page, true);
  await expect(page.locator('[data-motion-duration="slower"]')).toHaveText('0 ms');
  await quiet(page);
  before = await animations(page);

  await openDialog.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(openDialog).toBeFocused();

  await page.getByRole('button', { name: 'Move Write launch notes up' }).click();
  await expect(page.locator('[data-motion-list-status]')).toHaveText(
    'Write launch notes moved to position 1 of 4.'
  );
  await page.getByRole('button', { name: 'Open Lumen Docs' }).click();
  await expect(outcome(page, 'shared')).toHaveText('Instant: reduced-motion');
  await page.getByRole('button', { name: 'Back to all projects' }).click();
  await page
    .getByRole('toolbar', { name: 'Timeline' })
    .getByRole('button', { name: 'Play' })
    .click();
  await expect(outcome(page, 'timeline')).toHaveText('Instant: reduced-motion');
  await page.getByRole('button', { name: 'Play snappy' }).click();
  await expect(outcome(page, 'springs')).toHaveText('snappy: Instant: reduced-motion');
  await page.getByRole('button', { name: 'Advance a card' }).click();
  await expect(page.locator('[data-motion-board-status]')).toHaveText(
    'Audit the forms moved to Doing.'
  );
  expect(await animations(page)).toBe(before);

  // Level none is instant too, without the override.
  await setReduced(page, false);
  await page.getByRole('radio', { name: 'None' }).check();
  await page.getByRole('button', { name: 'Play sample' }).click();
  await expect(outcome(page, 'console')).toHaveText('Instant: level-none');
  expect(await animations(page)).toBe(before);
  await page.getByRole('radio', { name: 'Full' }).check();

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'none' });
    await quiet(page);
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  await quiet(page);
  expect(await axeViolations(page), 'forced colors').toEqual([]);
  expect(foreign).toEqual([]);
});

test('the player paints motion as data and refuses a motion outside the vocabulary', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const foreign = watchForeign(page);
  await countAnimations(page);
  await page.goto(`${origin()}/motion-page/#blueprint`);
  await settle(page);
  await hydrated(page, '[data-motion-blueprint]');
  const stage = page.locator('[data-motion-blueprint-stage]');
  await expect(stage.getByText('Release brief, week 44')).toBeVisible({ timeout: 20_000 });
  await expect(stage.getByText('Risk review')).toHaveCount(0);
  await expect(page.locator('[data-motion-blueprint-diagnostics]')).toContainText('No errors');

  const before = await animations(page);
  await stage.getByRole('switch', { name: 'Show the details' }).click();
  await expect(stage.getByText('Risk review')).toBeVisible();
  await expect(stage.getByText('Launch post')).toBeVisible();
  // Three staggered cards and the risk card play their enter presets.
  await expect.poll(() => animations(page)).toBeGreaterThanOrEqual(before + 4);
  await stage.getByRole('switch', { name: 'Show the details' }).click();
  await expect(stage.getByText('Risk review')).toHaveCount(0);

  await page.getByRole('radio', { name: 'A motion outside the vocabulary' }).check();
  await expect(page.locator('[data-motion-blueprint-stage="hostile"]')).toBeVisible();
  await expect(
    page.locator('[data-motion-blueprint-diagnostics] [data-code="invalid-motion"]')
  ).toContainText('"spin"');
  const hostile = page.locator('[data-motion-blueprint-stage="hostile"]');
  await expect(hostile.getByText('Release brief, week 44')).toBeVisible({ timeout: 20_000 });
  await quiet(page);
  const quietCount = await animations(page);
  await hostile.getByRole('switch', { name: 'Show the details' }).click();
  await expect(hostile.getByText('This card paints without its motion.')).toBeVisible();
  // The refused motion paints the node without animating it.
  expect(await animations(page)).toBe(quietCount);

  await quiet(page);
  expect(await axeViolations(page)).toEqual([]);
  expect(foreign).toEqual([]);
});

test('at 360 px nothing overflows and the settings work from the keyboard', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${origin()}/motion-page/`);
  await settle(page);
  for (const selector of [
    '[data-motion-console]',
    '[data-motion-presence]',
    '[data-motion-layout]',
    '[data-motion-board]',
    '[data-motion-shared]',
    '[data-motion-timeline]',
    '[data-motion-springs]',
    '[data-motion-tokens]',
    '[data-motion-blueprint]',
  ]) {
    await hydrated(page, selector);
  }
  await expect(
    page.locator('[data-motion-blueprint-stage]').getByText('Release brief, week 44')
  ).toBeVisible({ timeout: 20_000 });
  expect(await polishProblems(page)).toEqual([]);

  // Keyboard: the level radios move with the arrows, the override with Space.
  await page.getByRole('radio', { name: 'Full' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Subtle' })).toBeChecked();
  await expect(page.locator('[data-motion-duration="base"]')).toHaveText('120 ms');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'Reduced motion' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-motion-duration="base"]')).toHaveText('0 ms');
  await expect(page.locator('[data-motion-note="presence"]')).toContainText(
    'Level subtle, reduced motion on'
  );
});
