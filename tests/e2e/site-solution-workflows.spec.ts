import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/workflows/ (the Workflows Solution landing), on the built site
 * (`pnpm build` first), following the Slides landing spec:
 *
 * 1. the page: one h1, the registry status, the subnav anchors, the static viewer preview
 *    in the server HTML before any script runs, no console errors and no CSP violations;
 * 2. the demo island: it hydrates when scrolled into view; arrow keys select a step,
 *    rename, add, auto-layout, undo/redo and reset work, View source shows the graph as
 *    plain JSON;
 * 3. the Markdown twin at /solutions/workflows.md;
 * 4. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark.
 *
 * Copy and content are unit-tested in apps/website/tests/solutions/workflows-*.test.ts.
 */

const origin = serveDist();
const ROUTE = '/solutions/workflows/';

/** Every CSP violation and console error the page raises, from before its first script. */
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

async function useScheme(page: Page, colorScheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
}

const demo = (page: Page) => page.locator('[data-tx-workflows-demo]');
const island = (page: Page) => page.locator('astro-island:has([data-tx-workflows-demo])');
const status = (page: Page) => demo(page).getByRole('status');
const actions = (page: Page) => demo(page).getByRole('group', { name: 'Workflow actions' });
const counts = (page: Page) => demo(page).locator('.workflow-demo__counts');

/** Scrolls the demo into view and waits for hydration. There is no Start gate. */
async function startDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-workflows-demo]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(counts(page)).toHaveText('4 steps · 3 connections');
  await expect(status(page)).toContainText('Expense approval workflow loaded');
}

test('the landing renders its sections, status and server preview, with no errors', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-workflows-demo-preview="expense-approval"');
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Workflow graphs you can draw, check and embed.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: in development/);
  // The server preview ships in the HTML; the island renders the same live view, so the frame
  // shows one of them: the preview steps aside ([data-demo-live]).
  await expect(page.locator('[data-tx-workflows-demo-preview]')).toHaveCount(1);
  await expect(page.locator('[data-tx-workflows-demo-preview]')).toBeHidden();
  await expect(page.locator('[data-tx-workflows-demo][data-demo-live]')).toBeVisible();
  await expect(island(page)).toHaveAttribute('ssr', '');

  const subnav = page.getByRole('navigation', { name: 'Workflows page sections' });
  const links = subnav.locator('a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(6);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
    const id = (href ?? '').slice(1);
    await expect(page.locator(`[id="${id}"]`), href ?? '').toHaveCount(1);
  }
  await subnav.getByRole('link', { name: 'How it works' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#how-it-works');
  await expect(page.locator('#how-it-works')).toBeInViewport();

  await expect(page.locator('a[href="/workflows-page/"], a[href$="/workflows-page/"]')).toHaveCount(
    0
  );
  expect(await problems()).toEqual([]);
});

test('the demo hydrates on scroll; arrows, rename, add, layout, undo, redo, reset and source work', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);

  const first = demo(page).getByRole('button', { name: '1 Submit expense' });
  await first.focus();
  await page.keyboard.press('ArrowDown');
  const second = demo(page).getByRole('button', { name: '2 Manager review' });
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-pressed', 'true');

  await actions(page).getByRole('button', { name: 'Add notification' }).click();
  await expect(counts(page)).toHaveText('5 steps · 3 connections');
  await expect(demo(page).getByRole('button', { name: '5 Notify requester' })).toBeVisible();
  await expect(status(page)).toContainText('Notification step added');

  const label = demo(page).getByLabel('Step label');
  await label.fill('Send approval update');
  await demo(page).getByRole('button', { name: 'Update label' }).click();
  await expect(demo(page).getByRole('button', { name: '5 Send approval update' })).toBeVisible();
  await expect(status(page)).toContainText('Step label updated');

  await actions(page).getByRole('button', { name: 'Auto layout' }).click();
  await expect(status(page)).toContainText('Workflow arranged from left to right');

  const undo = actions(page).getByRole('button', { name: 'Undo' });
  const redo = actions(page).getByRole('button', { name: 'Redo' });
  await undo.click();
  await expect(status(page)).toContainText('Last workflow change undone');
  await redo.click();
  await expect(status(page)).toContainText('Workflow change restored');

  await actions(page).getByRole('button', { name: 'Reset' }).click();
  await expect(counts(page)).toHaveText('4 steps · 3 connections');
  await expect(demo(page).getByRole('button', { name: '5 Notify requester' })).toHaveCount(0);
  await expect(status(page)).toContainText('reset to its starting example');
  await expect(undo).toBeDisabled();

  await actions(page).getByRole('button', { name: 'View source' }).click();
  const source = demo(page).getByRole('region', { name: 'Workflow source as JSON' });
  await expect(source).toBeVisible();
  const text = (await source.locator('pre code').textContent()) ?? '';
  expect(() => JSON.parse(text)).not.toThrow();
  expect(text).toContain('manager-review');
  expect(await source.locator('code *').count()).toBe(0);

  expect(await problems()).toEqual([]);
});

test('the Markdown twin carries the landing', async () => {
  const response = await fetch(`${origin()}/solutions/workflows.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await response.text();
  expect(body).toContain('Workflow graphs you can draw, check and embed.');
  expect(body).toContain('https://texuli.com/solutions/workflows/');
  expect(body).toContain('Status: in development');
  expect(body).toContain('blueprint.validate');
});

test('at 390 px nothing overflows; axe has no serious violations in light and dark', async ({
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
  // Back to the top: the 390 px run leaves the demo toolbar under the sticky header, which axe
  // reads as an obscured (too small) target. The page is checked at rest.
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    const serious = (await axeViolations(page)).filter((v) => /\((serious|critical)\)/.test(v));
    expect(serious, scheme).toEqual([]);
  }
});
