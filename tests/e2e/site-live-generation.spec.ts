import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /live-generation/ (PLAN_010 T-site-070), on the built site: a
 * recorded draft replayed into the real `<Player stream>`.
 *
 * 1. the weekly report streams: paused, a pending node is a skeleton and
 *    the surface is busy and inert; one chunk at a time the sent count
 *    grows; at full speed it completes as a valid draft; axe in light,
 *    dark and forced colors mid-stream and complete; no request leaves
 *    the origin and the player loads only on Start;
 * 2. a node outside the catalog is held, never painted, and the final
 *    verdict refuses the draft;
 * 3. a dropped connection keeps the painted nodes, says so in an alert,
 *    and Try again streams the draft to completion;
 * 4. reduced motion reaches the player; at 360 px nothing overflows and
 *    the controls work from the keyboard.
 *
 * The recordings and the replay are unit-tested in
 * apps/website/tests/site-live-generation.test.ts.
 */

const origin = serveDist();

/** Emulates a color scheme and waits until the switch has started and finished its transitions. */
async function useScheme(
  page: Page,
  colorScheme: 'light' | 'dark',
  forcedColors: 'active' | 'none' = 'none'
): Promise<void> {
  await page.emulateMedia({ colorScheme, forcedColors });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
  await page.waitForFunction(
    () => document.getAnimations().every((animation) => animation.playState !== 'running'),
    undefined,
    { polling: 100, timeout: 10_000 }
  );
}

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

async function open(page: Page): Promise<void> {
  await page.goto(`${origin()}/live-generation/`);
  await settle(page);
  await page.locator('[data-live-generation]').scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-live-generation]')).toBeVisible({
    timeout: 20_000,
  });
}

const player = (page: Page) => page.locator('[data-live-stage] [data-tx-player]');
const surface = (page: Page) => page.locator('[data-live-stage] [data-tx-player-surface]');
const count = async (page: Page, name: 'painted' | 'held') =>
  Number(await page.locator(`[data-live-${name}]`).textContent());
const sent = async (page: Page) =>
  Number(((await page.locator('[data-live-sent]').textContent()) ?? '0').split(' ')[0]);

test('streams the weekly report: skeletons, steps, completion, and axe throughout', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const foreign = watchForeign(page);
  const scripts: string[] = [];
  page.on('requestfinished', (request) => {
    if (request.url().endsWith('.js')) scripts.push(new URL(request.url()).pathname);
  });
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    "Watch an agent's draft paint as it streams"
  );
  await expect(page.getByText('no network request, no model and no key')).toBeVisible();
  await expect(page.locator('[data-live-stage]')).toContainText('Press Start');
  const beforeStart = scripts.length;

  await page.getByRole('radio', { name: 'Slow' }).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-status', 'streaming', { timeout: 30_000 });
  // The player arrived on Start, not before.
  expect(scripts.length).toBeGreaterThan(beforeStart);
  await expect.poll(() => count(page, 'painted'), { timeout: 30_000 }).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await expect(surface(page)).toHaveAttribute('aria-busy', 'true');
  await expect(surface(page)).toHaveAttribute('inert', '');
  await expect(page.locator('[data-live-phase]')).toHaveText('streaming');

  // One chunk at a time until a node waits as a skeleton.
  const pending = page.locator('[data-live-stage] [data-tx-player-stream-node="pending"]');
  for (let i = 0; i < 80 && (await pending.count()) === 0; i += 1) {
    const before = await sent(page);
    await page.getByRole('button', { name: 'Next chunk' }).click();
    await expect.poll(() => sent(page)).toBe(before + 1);
  }
  await expect(pending.first()).toBeAttached();
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    expect(await axeViolations(page), `${scheme} mid-stream`).toEqual([]);
  }
  await useScheme(page, 'light');

  await page.getByRole('radio', { name: 'Fast' }).check();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('[data-live-phase]')).toHaveText('complete', { timeout: 60_000 });
  await expect(player(page)).toHaveAttribute('data-status', 'draft', { timeout: 30_000 });
  await expect(surface(page)).not.toHaveAttribute('aria-busy', /.*/);
  await expect(
    page.locator('[data-live-stage]').getByText('Harbor support, week 44')
  ).toBeVisible();
  await expect(page.locator('[data-live-stage] [data-tx-player-skeleton]')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-live-log]')).toContainText('Complete:');
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    expect(await axeViolations(page), `${scheme} complete`).toEqual([]);
  }
  await useScheme(page, 'light', 'active');
  expect(await axeViolations(page), 'forced colors complete').toEqual([]);
  expect(foreign).toEqual([]);
});

test('holds a node outside the catalog and refuses the draft at the end', async ({ page }) => {
  test.setTimeout(120_000);
  const foreign = watchForeign(page);
  await open(page);
  await page.getByRole('radio', { name: 'A node outside the catalog' }).check();
  await page.getByRole('radio', { name: 'Fast' }).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => count(page, 'held'), { timeout: 60_000 }).toBeGreaterThan(0);
  await expect(page.locator('[data-live-log]')).toContainText('Held a node');
  // The foreign node's props never reach the screen.
  await expect(page.locator('[data-live-stage]')).not.toContainText('sendBeacon');
  await expect(player(page)).toHaveAttribute('data-status', 'invalid', { timeout: 60_000 });
  await expect(page.locator('[data-live-phase]')).toHaveText('complete');
  await expect(page.locator('[data-live-stage]')).not.toContainText('sendBeacon');
  expect(await axeViolations(page)).toEqual([]);
  expect(foreign).toEqual([]);
});

test('a dropped connection keeps what painted, and Try again completes the draft', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page);
  await page.getByRole('radio', { name: 'A dropped connection' }).check();
  await page.getByRole('radio', { name: 'Fast' }).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-status', 'interrupted', { timeout: 60_000 });
  await expect(page.locator('[data-live-phase]')).toHaveText('interrupted');
  expect(await count(page, 'painted')).toBeGreaterThan(0);
  const alert = page.locator('[data-live-stage]').getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(surface(page)).not.toHaveAttribute('inert', /.*/);
  expect(await axeViolations(page)).toEqual([]);
  await page.locator('[data-live-stage]').getByRole('button', { name: 'Try again' }).click();
  await expect(player(page)).toHaveAttribute('data-status', 'draft', { timeout: 60_000 });
  await expect(page.locator('[data-live-log]')).toContainText('Try again');

  // The page's own drop control interrupts a live stream too.
  await page.getByRole('radio', { name: 'Slow' }).check();
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(player(page)).toHaveAttribute('data-status', 'streaming', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Drop the connection' }).click();
  await expect(player(page)).toHaveAttribute('data-status', 'interrupted', { timeout: 30_000 });
});

test('reduced motion reaches the player; at 360 px nothing overflows and the keyboard works', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.getByText('(on in your system settings)')).toBeVisible();
  expect(await polishProblems(page)).toEqual([]);

  // Keyboard: the speed radios move with the arrows; Start from the keyboard.
  await page.getByRole('radio', { name: 'Normal' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Fast' })).toBeChecked();
  await page.getByRole('button', { name: 'Start', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(player(page)).toHaveAttribute('data-tx-motion', 'reduce', { timeout: 30_000 });
  await expect(player(page)).toHaveAttribute('data-status', 'draft', { timeout: 60_000 });
  expect(await polishProblems(page)).toEqual([]);

  // The page override works without the system setting too.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-live-generation]')).toHaveAttribute('data-reduced', 'false');
  await page.getByRole('checkbox', { name: /Reduced motion/ }).check();
  await expect(page.locator('[data-live-generation]')).toHaveAttribute('data-reduced', 'true');
  await expect(player(page)).toHaveAttribute('data-tx-motion', 'reduce');
});
