import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /native/ and /native/compatibility/ on the built site (`pnpm build` first):
 *
 * 1. /native/: one h1, honest platform statuses (web available, Compose Desktop in
 *    development, Android and iOS planned and never "available"), the demo island still
 *    server-rendered below the fold, the FAQ opens from the keyboard, the summary links the
 *    full matrix, no console errors and no CSP violations;
 * 2. the demo island hydrates on scroll: View JSON shows the validated fixture, the web
 *    player renders it on request, Reset hides both again;
 * 3. /native/compatibility/: one h1, a captioned table with column and row headers, one row
 *    per catalog component, and the CSS group and status filters;
 * 4. both Markdown twins;
 * 5. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark.
 *
 * Content is unit-tested in apps/website/tests/solutions/native-*.test.ts.
 */

const origin = serveDist();

/** Every CSP violation and console error the page raises, from before its first script. */
async function watchProblems(page: Page): Promise<() => Promise<string[]>> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    // WebKit reports this benign layout notice when the player measures itself; it is not a failure.
    if (/^ResizeObserver loop/.test(error.message)) return;
    errors.push(`pageerror: ${error.message}`);
  });
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

async function useScheme(page: Page, colorScheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
}

const island = (page: Page) => page.locator('[data-tx-native-demo-island]');

test('/native/ states honest statuses, keeps the demo below the fold, and opens the FAQ', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}/native/`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-native-demo-preview="report-on-demand"');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your interface language, beyond the browser.'
  );

  const row = (id: string) => page.locator(`[data-tx-native-status="${id}"]`);
  await expect(row('web')).toHaveAttribute('data-status', 'available');
  await expect(row('compose-desktop')).toHaveAttribute('data-status', 'in development');
  for (const id of ['android', 'ios']) {
    await expect(row(id)).toHaveAttribute('data-status', 'planned');
    await expect(row(id)).toContainText('Planned');
    await expect(row(id)).not.toContainText(/available/i);
  }

  // The island stays server-rendered until it scrolls into view.
  await expect(page.locator('astro-island:has([data-tx-native-demo-island])')).toHaveAttribute(
    'ssr',
    ''
  );

  // The summary links the full matrix, which exists.
  const more = page.locator('[data-tx-native-matrix-link]');
  await expect(more).toHaveAttribute('href', '/native/compatibility/');

  // The FAQ opens and closes from the keyboard.
  const item = page.locator('[data-tx-native-faq-item]').first();
  const summary = item.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(item).not.toHaveAttribute('open', '');

  expect(await problems()).toEqual([]);
});

test('the demo island hydrates on scroll, shows the fixture, renders it with the player, and resets', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}/native/`);
  await settle(page);
  await island(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-native-demo-island]')).toBeVisible({
    timeout: 20_000,
  });
  const status = island(page).getByRole('status');
  await expect(status).toContainText('fixture ready');

  await island(page).getByRole('button', { name: 'View JSON' }).click();
  const json = island(page).getByRole('textbox', { name: 'Blueprint JSON text' });
  await expect(json).toBeVisible();
  expect(JSON.parse(await json.inputValue()).id).toBe('report-week-42');

  await island(page).getByRole('button', { name: 'Render with the web player' }).click();
  await expect(
    island(page).getByRole('region', { name: 'Live web player rendering' })
  ).toContainText('Delivery report, week 42', { timeout: 20_000 });

  const reset = island(page).getByRole('button', { name: 'Reset demo' });
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(status).toContainText('Demo reset');
  await expect(json).toHaveCount(0);
  await expect(island(page).getByRole('region', { name: 'Live web player rendering' })).toHaveCount(
    0
  );

  expect(await problems()).toEqual([]);
});

test('/native/compatibility/ is a captioned table with row headers and working filters', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}/native/compatibility/`);
  expect(response?.status()).toBe(200);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Native compatibility');
  await expect(page.locator('a[href="/native/"]').first()).toBeVisible();
  const table = page.locator('table.native-matrix__table');
  await expect(table.locator('caption')).toContainText('Web and native compatibility for spec');
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(6);
  const rows = table.locator('tbody tr');
  const total = await rows.count();
  expect(total).toBeGreaterThan(100);
  await expect(table.locator('tbody th[scope="row"]')).toHaveCount(total);

  // No Android or iOS cell claims support: those renderers have no column at all yet.
  await expect(table.locator('thead')).not.toContainText(/Android|iOS/);

  // The group filter keeps only that group's rows; "All groups" brings every row back.
  const dataRows = await table.locator('tbody tr[data-group="data"]').count();
  expect(dataRows).toBeGreaterThan(0);
  await page.locator('#native-matrix-group-data').check();
  await expect(table.locator('tbody tr:visible')).toHaveCount(dataRows);
  await page.locator('#native-matrix-group-all').check();
  await expect(table.locator('tbody tr:visible')).toHaveCount(total);

  // The status filter keeps the rows carrying that status.
  const planned = await table.locator('tbody tr[data-statuses~="planned"]').count();
  await page.locator('#native-matrix-status-planned').check();
  await expect(table.locator('tbody tr:visible')).toHaveCount(planned);

  expect(await problems()).toEqual([]);
});

test('both pages have a Markdown twin', async () => {
  for (const [twin, h1] of [
    ['/native.md', 'Your interface language, beyond the browser.'],
    ['/native/compatibility.md', 'Native compatibility'],
  ] as const) {
    const response = await fetch(`${origin()}${twin}`);
    expect(response.status, twin).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(await response.text(), twin).toContain(h1);
  }
});

test('at 390 px nothing overflows; axe has no serious violations in light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const route of ['/native/', '/native/compatibility/']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin()}${route}`);
    await settle(page);
    expect(await polishProblems(page), route).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
      route
    ).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const scheme of ['light', 'dark'] as const) {
      await useScheme(page, scheme);
      const serious = (await axeViolations(page)).filter((v) => /\((serious|critical)\)/.test(v));
      expect(serious, `${route} ${scheme}`).toEqual([]);
    }
  }
});
