import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * The Agent chat Solution landing (PLAN_023 T-sol-chat) on the built site: fixture replies
 * stream with Stop, the composer autocompletes mentions and commands, attachments paint only
 * after they validate (one is refused, with its reason), and a reply copies to chat dialects.
 */

const origin = serveDist();
const ROUTE = '/solutions/agent-chat/';
const demo = (page: Page) => page.locator('[data-tx-agent-chat-demo]');
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

async function openDemo(page: Page): Promise<void> {
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-agent-chat-demo]')).toBeVisible({
    timeout: 20_000,
  });
}

const log = (page: Page) =>
  demo(page).getByRole('log', { name: 'Conversation with the demo agent' });
const composer = (page: Page) => demo(page).getByRole('textbox', { name: 'Message' });

test('the Agent chat landing renders its registry status, honest copy and one island', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toContain('fixture replies, no live model');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A chat where agent replies become working interfaces.'
  );
  await expect(page.locator('astro-island:has([data-tx-agent-chat-demo])')).toHaveCount(1);
  expect(await problems()).toEqual([]);
});

test('a scenario streams, stops, and attaches blueprints that paint only after they validate', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = await watchProblems(page);
  await openDemo(page);

  // Stop keeps the partial reply and marks it.
  await demo(page).getByRole('button', { name: 'Weekly report' }).click();
  const stop = demo(page).getByRole('button', { name: 'Stop generating' });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(log(page).getByText('Stopped before the end')).toBeVisible();
  await expect(log(page).getByRole('figure')).toHaveCount(0);

  // The full report: one attachment validates and paints, the forecast is refused.
  await demo(page).getByRole('button', { name: 'Weekly report' }).click();
  const report = log(page).getByRole('figure', { name: 'Support weekly report' });
  await expect(report).toBeVisible({ timeout: 30_000 });
  const refused = log(page).getByRole('figure', { name: 'Revenue forecast' });
  await expect(refused).toHaveAttribute('data-state', 'refused');
  await expect(refused).toContainText('unknown-id');
  await expect(refused.getByRole('button')).toHaveCount(0);
  await report.getByRole('button', { name: 'Show preview' }).click();
  await expect(report.getByText('Conversations per day').first()).toBeVisible({ timeout: 30_000 });
  await expect(report.getByRole('button', { name: 'Hide preview' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );

  // The reply copies to another chat dialect.
  await demo(page).getByLabel('Format').selectOption('discord');
  await expect(demo(page).locator('[data-tx-agent-chat-export]')).toContainText(
    '**412 conversations**'
  );
  expect(await problems()).toEqual([]);
});

test('the composer autocompletes a command and a mention from the keyboard', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = await watchProblems(page);
  await openDemo(page);
  const field = composer(page);

  await field.fill('/fo');
  const commands = demo(page).getByRole('listbox', { name: 'Commands' });
  await expect(commands).toBeVisible();
  await field.press('Enter');
  await expect(commands).toBeHidden();
  await expect(field).toHaveValue('/form ');
  await field.pressSequentially('for @av');
  const people = demo(page).getByRole('listbox', { name: 'People' });
  await expect(people.getByRole('option', { selected: true })).toContainText('Avery Chen');
  await field.press('Enter');
  await expect(field).toHaveValue('/form for @[Avery Chen](mention:avery) ');
  await field.press('Enter');

  await expect(log(page).locator('[data-mention-id="avery"]')).toBeVisible();
  const form = log(page).getByRole('figure', { name: 'Workshop sign-up' });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.getByRole('button', { name: 'Show preview' }).click();
  await expect(form.getByLabel('Your name')).toBeVisible({ timeout: 30_000 });
  expect(await problems()).toEqual([]);
});

test('at 390 px the landing fits and has no serious axe violations in light and dark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  expect(await polishProblems(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  // A finished reply with an open preview is part of what axe sees.
  await demo(page).getByRole('button', { name: 'Support triage' }).click();
  const triage = log(page).getByRole('figure', { name: 'Overnight queue' });
  await expect(triage).toBeVisible({ timeout: 30_000 });
  await triage.getByRole('button', { name: 'Show preview' }).click();
  await expect(triage.getByText('Waiting on customer').first()).toBeVisible({ timeout: 30_000 });
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
