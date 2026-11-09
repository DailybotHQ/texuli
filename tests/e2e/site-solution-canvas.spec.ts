import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/canvas/ (the Canvas Solution landing), on the built site
 * (`pnpm build` first):
 *
 * 1. the page: one h1, registry status, working section anchors, a static preview in server
 *    HTML before hydration, no link to the replaced page, console errors or CSP violations;
 * 2. the demo island hydrates on scroll; adding a note, moving a shape from the keyboard,
 *    viewing the canvas source and resetting all work;
 * 3. the Markdown twin at /solutions/canvas.md;
 * 4. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark.
 *
 * Copy and section content are unit-tested in apps/website/tests/solutions/canvas-*.test.ts.
 */

const origin = serveDist();
const ROUTE = '/solutions/canvas/';

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

const demo = (page: Page) => page.getByRole('region', { name: 'Interactive launch plan canvas' });
const island = (page: Page) => page.locator('astro-island:has(.canvas-demo)');
const status = (page: Page) => demo(page).locator('.canvas-demo__announcement');
const controls = (page: Page) => demo(page).getByRole('group', { name: 'Canvas actions' });

/** Scrolls the demo into view and waits for its visible island to hydrate. */
async function hydrateDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) .canvas-demo')).toBeVisible({
    timeout: 20_000,
  });
  await expect(controls(page)).toBeVisible();
}

test('the landing renders its sections, status and server preview without errors', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('Launch plan canvas preview');
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Give every idea room to connect.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: in development/);
  await expect(page.getByRole('region', { name: 'Canvas demo static preview' })).toBeVisible();
  await expect(island(page)).toHaveAttribute('ssr', '');

  const subnav = page.getByRole('navigation', { name: 'Canvas page sections' });
  const links = subnav.locator('a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(6);
  for (const href of await links.evaluateAll((all) =>
    all.map((link) => link.getAttribute('href'))
  )) {
    const id = (href ?? '').slice(1);
    await expect(page.locator(`[id="${id}"]`), href ?? '').toHaveCount(1);
  }
  await subnav.getByRole('link', { name: 'How it works' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#how-it-works');
  await expect(page.locator('#how-it-works')).toBeInViewport();

  await expect(page.locator('a[href*="/canvas-page/"]')).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('the demo hydrates on scroll; add, keyboard move, source and reset work', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await hydrateDemo(page);

  await controls(page).getByRole('button', { name: 'Add priority note' }).click();
  await expect(status(page)).toContainText('Priority note added and selected.');
  await expect(
    demo(page).getByRole('button', { name: 'Confirm beta launch date, sticky' })
  ).toBeVisible();

  // The shape list supports keyboard selection and movement with the arrow keys.
  const interview = demo(page).getByRole('button', { name: 'Talk to twelve customers, sticky' });
  await interview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(status(page)).toContainText('Selected shape moved.');

  await controls(page).getByRole('button', { name: 'View source' }).click();
  const source = demo(page).locator('#canvas-demo-source');
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('tabindex', '0');
  const changed = JSON.parse((await source.locator('code').textContent()) ?? '{}');
  expect(changed.shapes.some((shape: { id: string }) => shape.id === 'priority-note-1')).toBe(true);
  expect(changed.shapes[0].children[0].x).toBe(40);

  await controls(page).getByRole('button', { name: 'Reset' }).click();
  await expect(status(page)).toContainText('Launch plan canvas reset to its starting example.');
  await expect(source).toBeHidden();
  await expect(
    demo(page).getByRole('button', { name: 'Confirm beta launch date, sticky' })
  ).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('the Markdown twin carries the landing facts', async () => {
  const response = await fetch(`${origin()}/solutions/canvas.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await response.text();
  expect(body).toContain('Give every idea room to connect.');
  expect(body).toContain('https://texuli.com/solutions/canvas/');
  expect(body).toContain('Status: in development');
  expect(body).toContain('Sketch a launch plan');
  expect(body).toContain('blueprint.validate');
});

test('at 390 px nothing overflows; axe has no serious violations in light and dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await hydrateDemo(page);
  expect(await polishProblems(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    const serious = (await axeViolations(page)).filter((violation) =>
      /\((serious|critical)\)/.test(violation)
    );
    expect(serious, scheme).toEqual([]);
  }
});
