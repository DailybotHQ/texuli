import { expect, type Page, test } from '@playwright/test';
import { axeViolations, expectMode, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /dashboards-page/ (PLAN_010 T-site-080), in the browser:
 *
 * 1. the live dashboard reads its widgets from the in-page source, moves a
 *    widget by keyboard with every step announced (and echoed visibly),
 *    cancels with Escape, saves the layout as JSON, forces each
 *    breakpoint and turns the glide off; axe in light and dark with every
 *    island hydrated;
 * 2. the persistence lab round-trips the saved layout, repairs the
 *    tampered one with issues listed and refuses the rest;
 * 3. the player paints the agent dashboard with rows from the host source,
 *    persists a keyboard move in its state and refuses the URL binding; at
 *    360 px nothing overflows.
 *
 * Data and copy are unit-tested in apps/website/tests/site-dashboards.test.ts.
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
  await page.goto(`${origin()}/dashboards-page/`);
  await settle(page);
  return foreign;
}

test('the live dashboard: source data, keyboard moves announced, breakpoints; axe light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foreign = await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Dashboards people arrange, from the keyboard too'
  );
  await expect(
    page.getByText('@texuli/data/dashboard · unreleased · coming in 0.8.0')
  ).toBeVisible();
  await expect(page.locator('[data-dashboards-breakpoints] tbody tr')).toHaveCount(3);

  await hydrated(page, '[data-dashboards-workbench]');
  const board = page.locator('[data-dashboards-workbench]');
  await expect(board.locator('[data-dashboards-metric="signups"]')).toHaveText('1,284', {
    timeout: 10_000,
  });
  await expect(board.locator('[data-dashboards-tickets] li')).toHaveCount(5);
  await expect(page.locator('[data-dashboards-calls]')).toContainText('tickets');

  // Keyboard: pick Signups up, move it one column right, drop it.
  await board.getByRole('radio', { name: 'Wide: 12 columns' }).check();
  await expect(page.locator('[data-dashboards-breakpoint]')).toContainText('lg');
  const handle = board.getByRole('button', { name: 'Move Signups' });
  await handle.focus();
  await page.keyboard.press('Enter');
  const heard = page.locator('[data-dashboards-heard]');
  await expect(heard).toContainText('Signups picked up. Column 1, row 1.');
  await page.keyboard.press('ArrowRight');
  await expect(heard).toContainText('Signups moved to column 2, row 1.');
  await page.keyboard.press('Enter');
  await expect(heard).toContainText('Signups dropped at column 2, row 1.');
  await expect(page.locator('[data-dashboards-saved]')).toContainText(
    '"format":"texuli-dashboard"'
  );
  // Escape puts a widget back.
  await board.getByRole('button', { name: 'Move Revenue' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(heard).toContainText('Change cancelled. Revenue is back');
  // A locked widget does not move.
  await expect(board.getByRole('button', { name: 'Move Uptime (locked)' })).toHaveCount(0);

  // Breakpoints: forced narrow is one column; motion can be turned off.
  await board.getByRole('radio', { name: 'Narrow: 1 column' }).check();
  await expect(page.locator('[data-dashboards-breakpoint]')).toContainText('sm');
  // Measured: the container picks (the page column is narrower than 1,024 px).
  await board.getByRole('radio', { name: 'Measured' }).check();
  await expect(page.locator('[data-dashboards-breakpoint]')).toContainText(
    /(md|sm) \(measured from the container\)/
  );
  await board.getByRole('checkbox', { name: 'Glide to the new cell' }).uncheck();
  await board.getByRole('button', { name: 'Refresh the data' }).click();
  await expect(board.locator('[data-dashboards-metric="signups"]')).toHaveText('1,301', {
    timeout: 10_000,
  });

  await hydrated(page, '[data-dashboards-persist]');
  await hydrated(page, '[data-dashboards-agent]');
  await expect(page.locator('[data-dashboards-agent-stage] [data-dashboard-widget]')).toHaveCount(
    3,
    {
      timeout: 20_000,
    }
  );
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectMode(page, scheme);
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('persistence: the saved layout round-trips, the tampered one is repaired, the rest refused', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  await hydrated(page, '[data-dashboards-persist]');
  const lab = page.locator('[data-dashboards-persist]');
  const result = page.locator('[data-dashboards-persist-result]');
  await expect(result).toContainText('Restored as saved: 5 widgets on the wide grid, no issues.');
  await lab.getByRole('button', { name: 'Tampered' }).click();
  await expect(page.locator('[data-dashboards-persist-issues]')).toContainText(
    'Duplicate widget id "signups"'
  );
  await expect(page.locator('[data-dashboards-persist-issues]')).toContainText(
    'No breakpoint "huge"'
  );
  await lab.getByRole('button', { name: 'Too large' }).click();
  await expect(page.locator('[data-dashboards-persist-refused]')).toContainText(
    'The saved dashboard is too large.'
  );
  await lab.getByRole('button', { name: 'Not JSON' }).click();
  await expect(page.locator('[data-dashboards-persist-refused]')).toContainText('not JSON');
});

test('the player paints the agent dashboard from the host source and refuses a URL; 360 px fits', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await hydrated(page, '[data-dashboards-agent]');
  const stage = page.locator('[data-dashboards-agent-stage]');
  await expect(stage.getByText('Checkout latency on eu.example.com')).toBeVisible({
    timeout: 20_000,
  });
  const handle = stage.getByRole('button', { name: 'Move Uptime' });
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-dashboards-agent-state]')).toContainText('"id":"uptime"');
  await page.getByRole('button', { name: 'Send the hostile dashboard' }).click();
  await expect(page.locator('[data-dashboards-agent-refused]')).toBeVisible({ timeout: 20_000 });
  await expect(stage.locator('[data-dashboard-widget]')).toHaveCount(0);
  await hydrated(page, '[data-dashboards-workbench]');
  await hydrated(page, '[data-dashboards-persist]');
  expect(await polishProblems(page)).toEqual([]);
});
