import { expect, type Page, test } from '@playwright/test';
import { axeViolations, serveDist, settle } from './support/site.ts';

/*
 * texuli.com drag and workflows pages (PLAN_007 T-site-workbench), in the
 * browser, one page session per test: the hero workbench moves items by
 * keyboard and pointer and logs what a screen reader hears; the canvas
 * zooms; the workflow editor, viewer and JSON live preview mount; nothing
 * leaves the origin; axe is clean. Copy and data are unit-tested in
 * apps/website/tests/site-drag*.test.ts.
 */

const origin = serveDist();

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  return foreign;
}

/** Waits until the island that holds `selector` has hydrated (Astro drops `ssr`). */
async function hydrated(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 15_000,
  });
}

const names = (page: Page, list: string) =>
  page
    .getByRole('list', { name: list, exact: true })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));

test('drag page: one engine moves list, board and canvas items by keyboard and pointer', async ({
  page,
}) => {
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/drag-page/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'One drag engine, every surface'
  );
  await hydrated(page, '.workbench');

  // Keyboard: pick up, move, drop; the log shows what was announced.
  const first = page.getByRole('list', { name: 'This week', exact: true }).getByRole('button', {
    name: 'Write launch notes',
  });
  await first.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect
    .poll(() => names(page, 'This week'))
    .toEqual([
      'Refresh pricing page',
      'Write launch notes',
      'Check status page',
      'Send May invoices',
    ]);
  await expect(page.locator('[data-drag-log]')).toContainText(
    'Write launch notes dropped at position 2 of 4'
  );
  await expect(page.locator('[aria-live="polite"]').first()).not.toBeEmpty();

  // Pointer: a card moves from To do into Doing.
  const card = page.getByRole('list', { name: 'To do', exact: true }).getByRole('button', {
    name: 'CSV export',
  });
  const target = page.getByRole('list', { name: 'Doing', exact: true }).getByRole('button', {
    name: 'Search index',
  });
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('board cards have no box');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height + 12, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => names(page, 'Doing')).toEqual(['Search index', 'CSV export']);

  // Right to left mirrors the surfaces.
  await page.getByRole('checkbox', { name: 'Right to left' }).check();
  await expect(page.locator('[data-drag-dir]')).toHaveAttribute('dir', 'rtl');

  // The canvas mounts on scroll and zooms from its toolbar.
  await hydrated(page, '[data-spatial-canvas]');
  await page
    .getByRole('toolbar', { name: 'Canvas tools' })
    .getByRole('button', { name: 'Zoom in' })
    .click();
  await expect(page.getByRole('toolbar', { name: 'Canvas tools' })).toContainText('120%');

  expect(await axeViolations(page)).toEqual([]);
  expect(foreign).toEqual([]);
});

test('workflows pages: the editor, the viewer and the JSON live preview mount and stay local', async ({
  page,
}) => {
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/workflows-page/`);
  await settle(page);
  await hydrated(page, '[data-workflow-counts]');
  await expect(page.locator('[data-workflow-counts]')).toHaveText('6 steps, 6 connections');
  await expect(page.getByText('Fetch customer').first()).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  // The JSON live preview: the default seed paints; an invalid blueprint never does.
  await page.goto(`${origin()}/workflows-page/json/`);
  await settle(page);
  await hydrated(page, '[data-json-preview]');
  const status = page.locator('[data-json-preview-status]');
  await expect(status).toHaveAttribute('data-phase', 'painted', { timeout: 15_000 });
  await expect(page.locator('[data-json-preview-stage]')).toContainText('Run the checks');
  await page.locator('[data-json-preview-seed]').selectOption('broken');
  await expect(status).toHaveAttribute('data-phase', 'refused');
  await expect(status).toContainText('Not rendered');
  await expect(
    page.locator('[data-json-preview-diagnostics] [data-code="unknown-id"]')
  ).toContainText('$.tree.children[0]');
  await expect(page.locator('[data-json-preview-cleared]')).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  expect(foreign).toEqual([]);
});
