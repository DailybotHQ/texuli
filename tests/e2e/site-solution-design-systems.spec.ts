import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/design-systems/ (the Design systems Solution landing, PLAN_017
 * T-landing), on the built site (`pnpm build` first), following the other Solution specs:
 *
 * 1. the page: one h1, the registry status, the five-step loop (create, review, approve,
 *    lock, share), the subnav anchors, the Protoyard band, the FAQ, the demo mount point,
 *    no console errors and no CSP violations;
 * 2. links: the kit, the Studio, the guide, the reference hub, Protoyard's own site and its
 *    Built with page, and honest copy (the CLI cannot prove who approved; no Protoyard
 *    numbers);
 * 3. the demo island (T-demo): server-rendered before any script, hydrates when scrolled
 *    into view; brand, mode and allow toggles work from the keyboard and the live region
 *    reports the locked check with its stable codes; reset restores the start;
 * 4. the Markdown twin at /solutions/design-systems.md;
 * 5. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark,
 *    with the demo hydrated.
 */

const origin = serveDist();
const ROUTE = '/solutions/design-systems/';

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

test('the landing renders the loop, its sections and status, with no errors', async ({ page }) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-solution-status="available"');
  expect(html).toContain('data-tx-ds-demo-mount');
  // The island's server render is the preview: the brand scope and its CSS before any script.
  expect(html).toContain('data-tx-ds-demo-scope');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  expect(html).toContain('[data-tx-ds="harborline"]{--tx-');
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your brand, locked in one file.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: available/);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();

  const steps = page.locator('[data-solution-story]');
  expect(
    await steps.evaluateAll((all) => all.map((el) => el.getAttribute('data-solution-story')))
  ).toEqual(['create', 'review', 'approve', 'lock', 'share']);
  await expect(page.locator('#features')).toContainText('texuli ds generate');
  await expect(page.locator('#features')).toContainText('The CLI cannot prove who approved');
  await expect(page.locator('#how-it-works')).toContainText('One document, every surface.');
  await expect(page.locator('[data-tx-ds-protoyard]')).toBeVisible();
  await expect(page.locator('[data-tx-ds-faq-item]')).toHaveCount(7);

  const subnav = page.getByRole('navigation', { name: 'Design systems page sections' });
  const links = subnav.locator('a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(6);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
    const id = (href ?? '').slice(1);
    await expect(page.locator(`[id="${id}"]`), href ?? '').toHaveCount(1);
  }
  await page.getByRole('link', { name: 'See it on a sample brand' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#demo');

  await expect(page.locator('#demo astro-island')).toHaveCount(1);
  expect(await problems()).toEqual([]);
});

test('links to the kit, Studio, guide, hub and Protoyard, and keeps the copy honest', async ({
  page,
}) => {
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  const hrefs = await page
    .locator('main a[href]')
    .evaluateAll((all) => all.map((a) => a.getAttribute('href') ?? ''));
  for (const route of [
    '/design-systems/kit/',
    '/theme-studio/',
    '/guides/solutions/design-systems/',
    '/design-systems/',
    '/built-with/protoyard/',
    'https://protoyard.app',
  ]) {
    expect(
      hrefs.some((href) => href.endsWith(route) || href === route),
      route
    ).toBe(true);
  }
  // Every internal link resolves in the built site.
  const internal = [
    ...new Set(hrefs.filter((href) => href.startsWith('/') && !href.startsWith('//'))),
  ].map((href) => href.split('#')[0] ?? href);
  for (const href of new Set(internal)) {
    const response = await fetch(`${origin()}${href}`);
    expect(response.status, href).toBe(200);
  }
  const text = (await page.locator('main').textContent()) ?? '';
  expect(text).not.toMatch(/31\s*(of|\/)\s*31/);
  expect(text).not.toMatch(/guaranteed compliance|proves approval|production ready/i);
  expect(text).toContain('Agents never approve');
  await expect(page.locator('[data-tx-ds-protoyard-link="external"]')).toHaveAttribute(
    'rel',
    'noopener'
  );
});

const demo = (page: Page) => page.locator('[data-tx-ds-demo]');

async function startDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('#demo astro-island:not([ssr]) [data-tx-ds-demo]')).toBeVisible({
    timeout: 20_000,
  });
}

test('the demo hydrates on scroll; brand, mode and allow toggles work from the keyboard', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);
  const status = demo(page).getByRole('status');
  await expect(status).toContainText('Locked check passed');

  // Brand radios: arrow keys move the choice, as native radios do.
  const harborline = demo(page).getByRole('radio', { name: /Harborline/ });
  await harborline.focus();
  await page.keyboard.press('ArrowDown');
  await expect(demo(page).getByRole('radio', { name: /Quillmark/ })).toBeChecked();
  await expect(demo(page)).toHaveAttribute('data-brand', 'quillmark');
  const scope = demo(page).locator('[data-tx-ds-demo-scope]');
  await expect(scope).toHaveAttribute('data-tx-ds', 'quillmark');
  await expect(demo(page).locator('[data-tx-ds-demo-report]')).toContainText('dropped value');
  // The compiled brand paints: the scope's primary color is the brand's, not the site's.
  const primary = await scope.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--tx-primary').trim()
  );
  expect(primary).not.toBe('');

  await demo(page).getByRole('radio', { name: 'Dark' }).check();
  await expect(scope).toHaveAttribute('data-tx-mode', 'dark');

  const badge = demo(page).getByRole('checkbox', { name: /Badge/ });
  await badge.focus();
  await page.keyboard.press('Space');
  await expect(status).toHaveText('Locked check failed: 1 finding (not-allowed).');
  await expect(demo(page).locator('[data-tx-ds-demo-finding="not-allowed"]')).toBeVisible();
  await demo(page)
    .getByRole('checkbox', { name: /ghost variant/ })
    .check();
  await demo(page)
    .getByRole('checkbox', { name: /ghost variant/ })
    .uncheck();
  await expect(status).toContainText('2 findings');
  await expect(demo(page).locator('[data-tx-ds-demo-finding="variant-not-allowed"]')).toBeVisible();

  await demo(page).getByRole('button', { name: 'Reset' }).click();
  await expect(status).toContainText('Locked check passed');
  await expect(demo(page)).toHaveAttribute('data-brand', 'harborline');
  expect(await problems()).toEqual([]);
});

test('the Markdown twin carries the landing', async () => {
  const response = await fetch(`${origin()}/solutions/design-systems.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await response.text();
  expect(body).toContain('Your brand, locked in one file.');
  expect(body).toContain('https://texuli.com/solutions/design-systems/');
  expect(body).toContain('Status: available');
  expect(body).toContain('texuli ds validate');
  expect(body).toContain('ds.generate');
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
  // Start axe from the top: after the resize the scroll position can leave a link half under
  // the sticky header, which axe's target-size rule reads as obscured (a position artifact).
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    const serious = (await axeViolations(page)).filter((v) => /\((serious|critical)\)/.test(v));
    expect(serious, scheme).toEqual([]);
  }
});
