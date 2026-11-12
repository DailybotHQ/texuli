import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/dashboards/ on the built site:
 * 1. server-rendered preview, sections and honest in-development copy;
 * 2. one lazy island with three fictional scenarios, date range, filters and movable/resizable widgets;
 * 3. no horizontal overflow at phone width, and no serious or critical axe violations in either theme.
 */

const origin = serveDist();
const ROUTE = '/solutions/dashboards/';
const demo = (page: Page) => page.locator('[data-tx-dashboards-demo]');
const island = (page: Page) => page.locator('astro-island:has([data-tx-dashboards-demo])');
const dashboard = (page: Page) => demo(page).getByRole('region', { name: /dashboard$/i });

async function watchProblems(page: Page): Promise<() => Promise<string[]>> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`csp: ${event.effectiveDirective} ${event.blockedURI || 'inline'}`);
    });
  });
  return async () => [
    ...errors,
    ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
  ];
}

async function startDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-dashboards-demo]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(dashboard(page)).toBeVisible();
}

test('the landing renders its sections, registry status and server preview without errors', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-dashboard-preview');
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toContain('not on npm yet');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A dashboard that fits the way you work.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: in development/);
  await expect(page.locator('[data-tx-dashboard-preview]')).toBeVisible();
  await expect(island(page)).toHaveAttribute('ssr', '');

  const subnav = page.getByRole('navigation', { name: 'Dashboards page sections' });
  const links = subnav.locator('a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(6);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
    const id = (href ?? '').slice(1);
    await expect(page.locator(`[id="${id}"]`), href ?? '').toHaveCount(1);
  }
  expect(await problems()).toEqual([]);
});

test('the dashboard island changes scenarios, filters and range, and supports keyboard and pointer layout', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);

  const board = dashboard(page);
  const metric = (name: string) =>
    board
      .locator('[data-tx-component="data-metric-card"]')
      .filter({ has: page.getByRole('heading', { name }) })
      .first();
  await expect(board.getByRole('heading', { name: 'Active users' })).toBeVisible();
  await expect(demo(page).getByText('2 sample regions match the current filters.')).toBeVisible();

  // FilterBar changes are sent back to the host. Clearing the North chip restores all six rows.
  await demo(page).getByRole('button', { name: 'Clear filters' }).click();
  await expect(demo(page).getByText('6 sample regions match the current filters.')).toBeVisible();

  // This preset is deterministic because the demo pins its idea of today.
  await demo(page)
    .getByRole('button', { name: /Choose reporting period|Change reporting period/ })
    .click();
  await page.getByRole('button', { name: 'Last 7 days' }).click();
  await expect(metric('Active users').getByText(/7 days/)).toBeVisible();

  // Scenario switches keep the board structure but replace its fictional KPI set.
  await demo(page)
    .getByRole('combobox', { name: 'Dashboard scenario' })
    .selectOption('support-ops');
  await expect(board.getByRole('heading', { name: 'Open tickets' })).toBeVisible();
  await demo(page)
    .getByRole('combobox', { name: 'Dashboard scenario' })
    .selectOption('sales-pipeline');
  await expect(board.getByRole('heading', { name: 'Pipeline value' })).toBeVisible();

  const move = board.getByRole('button', { name: 'Move Pipeline value' });
  await move.focus();
  await page.keyboard.press('Space');
  const arrange = board.getByRole('group', { name: 'Arrange Pipeline value' });
  await expect(arrange).toBeVisible();
  await arrange.getByRole('button', { name: 'Move right' }).click();
  await arrange.getByRole('button', { name: 'Done' }).click();

  const resize = board.getByRole('button', { name: 'Resize Pipeline value' });
  await resize.focus();
  await page.keyboard.press('Space');
  const resizeGroup = board.getByRole('group', { name: 'Arrange Pipeline value' });
  await resizeGroup.getByRole('button', { name: 'Wider' }).click();
  await resizeGroup.getByRole('button', { name: 'Done' }).click();

  const widget = board.locator('[data-widget-id="pipeline-value"]');
  const handle = board.getByRole('button', { name: 'Move Pipeline value' });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const before = await widget.getAttribute('style');
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => widget.getAttribute('style')).not.toBe(before);

  await demo(page).getByRole('button', { name: 'View source' }).click();
  const source = demo(page).getByRole('region', { name: 'Dashboard scenario source as JSON' });
  await expect(source).toBeVisible();
  const sourceText = await source.locator('code').textContent();
  expect(() => JSON.parse(sourceText ?? '')).not.toThrow();
  expect(await problems()).toEqual([]);
});

test('the landing fits a phone and has no serious axe violations in light or dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);
  expect(await polishProblems(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        )
    );
    const serious = (await axeViolations(page)).filter((violation) =>
      /\((serious|critical)\)/.test(violation)
    );
    expect(serious, scheme).toEqual([]);
  }
});
