import { expect, type Page, test } from '@playwright/test';
import { MOTION_ADOPTERS } from '../../apps/website/src/components/motion-site/adopters.ts';
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
  await expect(page.getByText('texuli/motion · in development · on npm from 0.6.0')).toBeVisible();

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
  await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);
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
  await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);
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

test('at 340 px the untrusted deck stage wraps its trust badge and its toolbar stays inside', async ({
  page,
}) => {
  await page.setViewportSize({ width: 340, height: 800 });
  await page.goto(`${origin()}/motion-page/`);
  await settle(page);
  await hydrated(page, '[data-motion-deck]');
  const more = page.locator('[data-motion-deck] .tx-deck-chrome-more');
  await expect(more).toBeVisible({ timeout: 20_000 });
  const box = await more.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(340);
  const row = page.locator('[data-motion-deck] .tx-deck-stage__chrome-row');
  expect(await row.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
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
    '[data-motion-presets]',
    '[data-motion-components]',
    '[data-motion-spring-lab]',
    '[data-motion-deck]',
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

test('every preset, every moving component, the spring lab and the deck levels', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const foreign = watchForeign(page);
  await countAnimations(page);
  await page.goto(`${origin()}/motion-page/#presets`);
  await settle(page);

  // Every preset card plays its enter and exit through the runtime.
  await hydrated(page, '[data-motion-presets]');
  await expect(page.locator('[data-motion-preset]')).toHaveCount(9);
  for (const preset of [
    'fade',
    'rise',
    'scale',
    'slide-start',
    'slide-end',
    'edge slide, bottom',
  ]) {
    const before = await animations(page);
    await page.getByRole('button', { name: `Play ${preset} enter` }).click();
    // The outcome is written only once the runtime's animation settles, so wait for it first
    // (generously: the host may be loaded), then prove the play went through
    // Element.animate. Under load the call lands late, never not at all.
    await expect(outcome(page, 'presets')).toHaveText(`${preset} enter: Played: finished`, {
      timeout: 15_000,
    });
    await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);
  }
  await page.getByRole('button', { name: 'Play rise exit' }).click();
  await expect(outcome(page, 'presets')).toHaveText('rise exit: Played: finished');
  await expect(page.locator('[data-motion-preset="fade"]')).toContainText('opacity');

  // Every component gallery overlay animates in, and focus comes back.
  await hydrated(page, '[data-motion-components]');
  const gallery = page.locator('[data-motion-components]');
  let before = await animations(page);
  const popover = gallery.getByRole('button', { name: 'Open popover' });
  await popover.click();
  await expect(page.getByText('Ada Example owns the release notes.')).toBeVisible();
  await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  await expect(popover).toBeFocused();
  before = await animations(page);
  await gallery.getByRole('button', { name: 'Actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  const alertTrigger = gallery.getByRole('button', { name: 'Archive board' });
  await alertTrigger.click();
  const alert = page.getByRole('alertdialog', { name: 'Archive the launch board?' });
  await expect(alert).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(alert).toBeHidden();
  await expect(alertTrigger).toBeFocused();
  before = await animations(page);
  await gallery.getByRole('button', { name: 'When does the beta open?' }).click();
  await expect(gallery.getByText('Next week, for every fictional pilot team.')).toBeVisible();
  await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);
  await expect(page.locator('[data-motion-adopters] tbody tr')).toHaveCount(MOTION_ADOPTERS.length);

  // The spring lab: the solver answers the sliders, and Play runs the spring.
  await hydrated(page, '[data-motion-spring-lab]');
  await page
    .locator('[data-motion-spring-lab]')
    .getByRole('button', { name: 'bouncy', exact: true })
    .click();
  await expect(page.locator('[data-spring-ratio]')).toContainText('0.46');
  const damping = page.locator('[data-spring="damping"]');
  await damping.focus();
  for (let index = 0; index < 40; index += 1) await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-spring-ratio]')).toContainText('overdamped');
  await page.getByRole('button', { name: 'Play this spring' }).click();
  await expect(outcome(page, 'spring-lab')).toHaveText('Played: finished');
  await expect(page.locator('[data-spring-easing]')).toContainText('linear(');

  // The deck: every transition at the page level; level none plays nothing.
  await hydrated(page, '[data-motion-deck]');
  const deck = page.locator('[data-motion-deck]');
  await expect(deck.getByRole('button', { name: 'Transition: slide' })).toBeEnabled({
    timeout: 20_000,
  });
  await expect(page.locator('[data-motion-deck-table] tbody tr')).toHaveCount(6);
  before = await animations(page);
  await deck.getByRole('button', { name: 'Transition: zoom' }).click();
  await expect(deck.getByRole('button', { name: 'Transition: zoom' })).toHaveAttribute(
    'aria-current',
    'true'
  );
  await expect.poll(() => animations(page), { timeout: 15_000 }).toBeGreaterThan(before);

  await page.locator('#settings').scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: 'None' }).check();
  await expect(page.locator('[data-motion-deck-level]')).toContainText('none');
  await page.locator('#presets').scrollIntoViewIfNeeded();
  await quiet(page);
  before = await animations(page);
  await page.getByRole('button', { name: 'Play scale enter' }).click();
  await expect(outcome(page, 'presets')).toHaveText('scale enter: Instant: level-none');
  await deck.getByRole('button', { name: 'Transition: morph' }).click();
  await expect(deck.getByRole('button', { name: 'Transition: morph' })).toHaveAttribute(
    'aria-current',
    'true'
  );
  expect(await animations(page)).toBe(before);
  await page.getByRole('radio', { name: 'Full' }).check();

  // Reduced motion: the presets commit at once.
  await setReduced(page, true);
  await page.getByRole('button', { name: 'Play fade enter' }).click();
  await expect(outcome(page, 'presets')).toHaveText('fade enter: Instant: reduced-motion');
  await setReduced(page, false);

  await expect(page.locator('[data-motion-inventory] > li')).toHaveCount(4);
  await quiet(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await quiet(page);
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  expect(foreign).toEqual([]);
});
