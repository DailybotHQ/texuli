import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /canvas-page/ (PLAN_010 T-site-features), in the browser:
 *
 * 1. the editor paints the launch board (every shape type), moves a shape
 *    from the keyboard, undoes it, zooms, and exports SVG and PNG as
 *    downloads; the vocabulary tables list every shape and tool; axe in
 *    light and dark with every island hydrated;
 * 2. two local replicas converge: a move in Ada's canvas shows in Lin's,
 *    and presence names the other person;
 * 3. the player paints the agent canvas read-only and refuses the hostile
 *    paint; at 360 px nothing overflows.
 *
 * Data and copy are unit-tested in apps/website/tests/site-canvas.test.ts.
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

async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function open(page: Page): Promise<string[]> {
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/canvas-page/`);
  await settle(page);
  return foreign;
}

/** A shape's box on screen. */
async function boxOf(page: Page, scope: string, id: string) {
  const box = await page.locator(`${scope} [data-tx-shape="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`no box for ${id}`);
  return box;
}

test('the editor: every shape, keyboard moves, undo, zoom, export; axe in light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foreign = await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'An infinite canvas you can use from the keyboard'
  );
  await expect(page.getByText('@texuli/canvas · in development · coming in 0.8.0')).toBeVisible();
  await expect(page.locator('[data-canvas-shapes] tbody tr')).toHaveCount(11);
  await expect(page.locator('[data-canvas-tools] tbody tr')).toHaveCount(12);

  await hydrated(page, '[data-canvas-workbench]');
  const stage = '[data-canvas-stage]';
  const surface = page.locator(stage).getByRole('application', { name: 'Canvas: Launch plan' });
  await expect(surface).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-canvas-count="shapes"]')).toHaveText('15 shapes');
  await expect(page.locator('[data-canvas-count="connectors"]')).toHaveText('5 connectors');
  for (const id of [
    'discover',
    'kickoff',
    'ready',
    'release',
    'timeline',
    'momentum',
    'scribble',
    'cover',
    'owner',
  ]) {
    await expect(page.locator(`${stage} [data-tx-shape="${id}"]`).first()).toBeAttached();
  }
  // The image has no resolver here, so its alt text paints.
  await expect(page.locator(stage).getByText('Launch cover sketch').first()).toBeAttached();

  // Select a shape (pointer), then move it two grid steps right from the keyboard, and undo.
  const kickoff = page.locator(`${stage} [data-tx-shape="kickoff"]`).first();
  await kickoff.click();
  await expect(kickoff).toBeFocused();
  await expect(page.locator('[data-canvas-selected]')).toHaveText('1 selected');
  const before = await boxOf(page, stage, 'kickoff');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => (await boxOf(page, stage, 'kickoff')).x)
    .toBeGreaterThan(before.x + 1);
  const toolbar = page.locator(stage).getByRole('toolbar', { name: 'Canvas tools' });
  // Consecutive keyboard moves of one shape may merge into one history step.
  const undo = toolbar.getByRole('button', { name: 'Undo' });
  await undo.click();
  if (await undo.isEnabled()) await undo.click();
  await expect
    .poll(async () => Math.round((await boxOf(page, stage, 'kickoff')).x))
    .toBe(Math.round(before.x));

  // Zoom from the editor's toolbar; the bar reads the controller.
  const zoom = page.locator('[data-canvas-zoom]');
  const zoomBefore = await zoom.textContent();
  await toolbar.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).not.toHaveText(zoomBefore ?? '');

  // Export: real downloads.
  const [svg] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export SVG' }).click(),
  ]);
  expect(svg.suggestedFilename()).toBe('launch-plan.svg');
  await expect(page.locator('[data-canvas-export-status]')).toContainText('Saved launch-plan.svg');
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]);
  expect(png.suggestedFilename()).toBe('launch-plan.png');

  await hydrated(page, '[data-canvas-collab]');
  await hydrated(page, '[data-canvas-agent]');
  await expect(page.locator('[data-canvas-peer="lin"]').getByRole('application')).toBeVisible({
    timeout: 20_000,
  });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('two local replicas converge, presence names the other person', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await hydrated(page, '[data-canvas-collab]');
  const ada = '[data-canvas-peer="ada"]';
  const lin = '[data-canvas-peer="lin"]';
  await expect(
    page.locator(lin).getByRole('application', { name: 'Lin’s canvas: Retro' })
  ).toBeVisible({
    timeout: 20_000,
  });
  const before = await boxOf(page, lin, 'went-well');
  await page.locator(`${ada} [data-tx-shape="went-well"]`).first().click();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => (await boxOf(page, lin, 'went-well')).y)
    .toBeGreaterThan(before.y + 1);
  await expect(page.locator('[data-canvas-presence="lin"]')).toContainText(
    'Ada is here, selecting went-well',
    {
      timeout: 5_000,
    }
  );
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect
    .poll(async () => Math.round((await boxOf(page, lin, 'went-well')).y))
    .toBe(Math.round(before.y));
});

test('the player paints the agent canvas and refuses the hostile paint; 360 px fits', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await hydrated(page, '[data-canvas-agent]');
  const stage = page.locator('[data-canvas-agent-stage]');
  await expect(stage.getByRole('img', { name: /Support flow/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Send the hostile canvas' }).click();
  await expect(page.locator('[data-canvas-agent-refused]')).toBeVisible({ timeout: 20_000 });
  await expect(stage.getByRole('img', { name: /Support flow/ })).toHaveCount(0);
  await hydrated(page, '[data-canvas-workbench]');
  await hydrated(page, '[data-canvas-collab]');
  expect(await polishProblems(page)).toEqual([]);
});
