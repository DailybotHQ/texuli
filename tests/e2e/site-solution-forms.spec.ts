import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

const origin = serveDist();
const ROUTE = '/solutions/forms/';
const demo = (page: Page) => page.locator('[data-tx-forms-demo]');
test.describe.configure({ mode: 'serial', timeout: 120_000 });

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

test('the Forms landing renders its registry status, sections and single server-rendered island', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toContain('Community workshop request');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Forms shaped by a schema. Ready for real workflows.'
  );
  await expect(page.locator('astro-island:has([data-tx-forms-demo])')).toHaveCount(1);
  await expect(page.locator('[data-tx-forms-demo]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Community workshop request' })).toBeVisible();
  expect(await problems()).toEqual([]);
});

test('the demo reveals conditional steps, autosaves locally and edits the schema', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-forms-demo]')).toBeVisible({
    timeout: 20_000,
  });

  const form = demo(page).getByRole('form', { name: 'Community workshop request' });
  await form.getByLabel('Your name').fill('Alex Example');
  await expect(
    demo(page).getByRole('status').filter({ hasText: 'Draft updated in this page session.' })
  ).toBeVisible();
  await form.getByLabel('Email address').fill('alex@example.com');
  await form.getByRole('combobox', { name: 'How will you join?' }).click();
  await page.getByRole('option', { name: 'In person' }).click();
  await form.getByRole('button', { name: 'Next' }).click();
  await expect(form.getByLabel('Arrival date')).toBeVisible();
  await expect(form.getByRole('heading', { name: 'Plan your visit' })).toBeVisible();

  await demo(page).locator('summary').getByText('Open the visual builder').click();
  const builder = demo(page).getByRole('region', { name: 'Form builder' });
  await expect(builder).toBeVisible();
  const canvas = builder.getByRole('list', { name: 'Form fields' });
  const firstHandle = canvas.getByRole('button', { name: /Reorder Your name/ });
  await firstHandle.focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(canvas.getByRole('listitem').nth(0)).toContainText('Email address');
  await expect(canvas.getByRole('listitem').nth(1)).toContainText('Your name');

  await builder.getByRole('button', { name: 'text', exact: true }).click();
  await expect(demo(page).getByText('3 fields in the authored schema.')).toBeVisible();
  await expect(builder.getByRole('heading', { name: 'Preview' })).toBeVisible();
  await builder.getByRole('button', { name: 'View JSON' }).click();
  const json = builder.locator('pre').last();
  const jsonText = (await json.textContent()) ?? '';
  expect(() => JSON.parse(jsonText)).not.toThrow();

  // Pointer-accessible move controls apply the same field order as the keyboard handle.
  await canvas.getByRole('button', { name: 'Move Text up' }).click();
  await canvas.getByRole('button', { name: 'Move Text up' }).click();
  await expect(canvas.getByRole('listitem').first()).toContainText('Text');
  expect(await problems()).toEqual([]);
});

test('at 390 px the landing fits and has no serious axe violations in light and dark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await expect(page.locator('[data-tx-forms-demo]')).toBeVisible();
  expect(await polishProblems(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        )
    );
    const serious = (await axeViolations(page)).filter((violation) =>
      /\((serious|critical)\)/.test(violation)
    );
    expect(serious, colorScheme).toEqual([]);
  }
});
