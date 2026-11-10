import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { axeViolations, DIST, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * /design-systems/kit/ (PLAN_016 T-t4-site, kit API §6), against the built site
 * (`pnpm build` first): the kit renders the fictional example brand Ledgerline from
 * build-time data, server-rendered and hydrated when visible. The page is reachable from the
 * nav, has its Markdown twin, raises no CSP violation or console error, passes axe in light
 * and dark with no overflow at 390 px, the mode switch works once hydrated, the matrix shows
 * the brand's allowed components with live samples, and no request leaves the origin.
 */

const origin = serveDist();
const ROUTE = '/design-systems/kit/';
const KIT = '[data-tx-ds-kit]';

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

/** Scrolls the kit into view and waits until the island has hydrated and the samples painted. */
async function hydrate(page: Page): Promise<void> {
  await page.locator(KIT).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:has([data-tx-ds-kit])')).not.toHaveAttribute(
    'ssr',
    /.*/,
    {
      timeout: 30_000,
    }
  );
  await page.locator('[data-tx-ds-kit-section="matrix"]').scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-tx-ds-kit-cell] [data-tx-component="button"]').first()
  ).toBeVisible({
    timeout: 30_000,
  });
}

test('the kit page renders the example brand from build-time data, server-side', async ({
  page,
}) => {
  const html = readFileSync(join(DIST, 'design-systems/kit/index.html'), 'utf8');
  // Server-rendered: the sections are in the HTML before any script runs.
  for (const section of ['foundations', 'voice', 'matrix', 'library'])
    expect(html, section).toContain(`data-tx-ds-kit-section="${section}"`);
  expect(html).toContain('Ledgerline');
  // The Markdown twin exists.
  expect(readFileSync(join(DIST, 'design-systems/kit.md'), 'utf8')).toContain('Design system kit');

  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Design system kit' })).toBeVisible();
  // Reachable from the site navigation.
  await expect(page.locator(`a[href="${ROUTE}"]`).first()).toBeAttached();
  await hydrate(page);
  expect(await problems()).toEqual([]);
});

test('shows only the brand’s allowed components, with live samples and the approval', async ({
  page,
}) => {
  await page.goto(`${origin()}${ROUTE}`);
  await hydrate(page);
  const enabled = await page
    .locator('[data-tx-ds-kit-component]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-tx-ds-kit-component')));
  expect(enabled).toEqual(['button', 'card', 'input']);
  await expect(page.locator('[data-tx-ds-kit-disallowed-components]')).toContainText('dialog');
  // The approval is declared, never verified.
  await expect(page.locator('.tx-ds-kit__approval').first()).toContainText('Draft');
  await expect(page.locator(KIT)).not.toContainText(/verified/i);
  await expect(page.locator('[data-tx-ds-kit-library="kpi-strip"]')).toBeVisible();
});

test('the mode switch works from the keyboard once hydrated', async ({ page }) => {
  await page.goto(`${origin()}${ROUTE}`);
  await hydrate(page);
  const radios = page.locator('[data-tx-ds-kit-modes] input[type="radio"]');
  await radios.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeChecked();
  const view = await page.locator(KIT).getAttribute('data-tx-ds-kit-mode-view');
  expect(['light', 'dark']).toContain(view);
  const modes = await page
    .locator('#tx-ds-kit-matrix-button [data-tx-ds-kit-mode]')
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-tx-ds-kit-mode')))]);
  expect(modes).toEqual([view]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} and does not overflow at 390 px`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto(`${origin()}${ROUTE}`);
    await hydrate(page);
    // hydrate() leaves the matrix in view; at that offset the sticky site header can sit over a
    // sample (axe target-size reads it as obscured, depending on font metrics). Audit from the top.
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await axeViolations(page)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
    expect(await polishProblems(page)).toEqual([]);
  });
}

test('makes no request outside the origin', async ({ page }) => {
  const base = new URL(origin()).origin;
  const outside: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== base)
      outside.push(request.url());
  });
  await page.goto(`${origin()}${ROUTE}`);
  await hydrate(page);
  expect(outside).toEqual([]);
});
