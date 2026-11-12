import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/slides/ (the Slides Solution landing), on the built site
 * (`pnpm build` first):
 *
 * 1. the page: one h1, the registry status, the subnav anchors, the static preview in the
 *    server HTML before any script runs, no console errors and no CSP violations;
 * 2. the demo island: it hydrates when scrolled into view, Start loads the stage, the
 *    Next and Previous buttons and the arrow keys move between slides, the scenario
 *    switch loads another deck, Reset returns to the first slide, View source shows the
 *    deck as plain text;
 * 3. the Markdown twin at /solutions/slides.md;
 * 4. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark.
 *
 * Copy and content are unit-tested in apps/website/tests/solutions/slides-*.test.ts.
 */

const origin = serveDist();
const ROUTE = '/solutions/slides/';

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

const demo = (page: Page) => page.locator('[data-tx-slides-demo]');
const island = (page: Page) => page.locator('astro-island:has([data-tx-slides-demo])');
const activeSlide = (page: Page) => demo(page).locator('[data-tx-deck-active="true"]');
const position = (page: Page) =>
  demo(page)
    .getByRole('status')
    .filter({ hasText: /^Slide \d+ of \d+/ });

/** Scrolls the demo into view, waits for hydration, and starts the stage. */
async function startDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-slides-demo]')).toBeVisible({
    timeout: 20_000,
  });
  await demo(page).getByRole('button', { name: 'Start interactive demo' }).click();
  await expect(activeSlide(page)).toBeVisible({ timeout: 20_000 });
  await expect(position(page)).toContainText('Slide 1 of');
}

/** Focuses the active slide and presses `key` until the position reads `expected`. */
async function pressOnStage(page: Page, key: string, expected: string): Promise<void> {
  await expect(async () => {
    await activeSlide(page).focus();
    await page.keyboard.press(key);
    await expect(position(page)).toContainText(expected, { timeout: 1500 });
  }).toPass({ timeout: 10_000 });
}

test('the landing renders its sections, status and server preview, with no errors', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  // The static preview and the hero are in the server HTML, before hydration.
  expect(html).toContain('data-tx-slides-demo-preview="texuli-in-motion"');
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Decks written as data, presented on the web.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: in development/);
  await expect(page.locator('[data-tx-slides-demo-preview]')).toBeVisible();
  // The island has not hydrated while it is below the fold.
  await expect(island(page)).toHaveAttribute('ssr', '');

  const subnav = page.getByRole('navigation', { name: 'Slides page sections' });
  const links = subnav.locator('a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(6);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
    const id = (href ?? '').slice(1);
    await expect(page.locator(`[id="${id}"]`), href ?? '').toHaveCount(1);
  }
  await subnav.getByRole('link', { name: 'How it works' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#how-it-works');
  await expect(page.locator('#how-it-works')).toBeInViewport();

  // No link to the page this landing replaces.
  await expect(page.locator('a[href*="/slides-page/"]')).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('the demo hydrates on scroll; buttons, keys, scenarios, reset and source all work', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);

  const first = await activeSlide(page).getAttribute('data-slide-id');
  const controls = demo(page).getByRole('group', { name: 'Slide deck controls' });
  // Previous, next and full screen live in the small bar under the slide.
  const bar = demo(page).getByRole('group', { name: 'Slide navigation' });
  await expect(bar.getByRole('button', { name: 'Full screen' })).toBeVisible();

  // Buttons, by keyboard.
  await bar.getByRole('button', { name: 'Next slide' }).focus();
  await page.keyboard.press('Enter');
  await expect(position(page)).toContainText('Slide 2 of');
  await expect(activeSlide(page)).not.toHaveAttribute('data-slide-id', first ?? '');
  await bar.getByRole('button', { name: 'Previous slide' }).focus();
  await page.keyboard.press('Enter');
  await expect(position(page)).toContainText('Slide 1 of');

  // The first click on the slide advances it (no separate focus click).
  const slideArea = demo(page).locator('.tx-deck-stage__viewport');
  await slideArea.scrollIntoViewIfNeeded();
  await slideArea.click();
  await expect(position(page)).toContainText('Slide 2 of');
  await bar.getByRole('button', { name: 'Previous slide' }).click();
  await expect(position(page)).toContainText('Slide 1 of');

  // Arrow keys on the stage (wait for the button move to settle first).
  await expect(activeSlide(page)).toHaveAttribute('data-slide-id', first ?? '');
  await pressOnStage(page, 'ArrowRight', 'Slide 2 of');
  await pressOnStage(page, 'ArrowLeft', 'Slide 1 of');

  // Scenario switch loads another deck.
  const scenario = controls.getByRole('combobox', { name: 'Scenario' });
  await scenario.selectOption('investor-pitch');
  await expect(position(page)).toContainText('Scenario changed');
  await expect(activeSlide(page)).not.toHaveAttribute('data-slide-id', first ?? '');
  const pitchFirst = await activeSlide(page).getAttribute('data-slide-id');

  // Reset returns to the first slide of the current deck, with its starting theme.
  await bar.getByRole('button', { name: 'Next slide' }).click();
  await expect(position(page)).toContainText('Slide 2 of');
  await controls.getByRole('button', { name: 'Reset example' }).click();
  await expect(position(page)).toContainText('Slide 1 of');
  await expect(position(page)).toContainText('Example reset');
  await expect(scenario).toHaveValue('investor-pitch');
  await expect(activeSlide(page)).toHaveAttribute('data-slide-id', pitchFirst ?? '');

  // View source shows the deck as plain text, not markup.
  await controls.getByRole('button', { name: 'View source' }).click();
  const source = demo(page).getByRole('region', { name: 'Deck source as JSON' });
  await expect(source).toBeVisible();
  const text = (await source.locator('pre code').textContent()) ?? '';
  expect(() => JSON.parse(text)).not.toThrow();
  expect(await source.locator('pre code *').count()).toBe(0);

  expect(await problems()).toEqual([]);
});

test('the Markdown twin carries the landing', async () => {
  const response = await fetch(`${origin()}/solutions/slides.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await response.text();
  expect(body).toContain('Decks written as data, presented on the web.');
  expect(body).toContain('https://texuli.com/solutions/slides/');
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
  // Back to the top: the 390 px run leaves the demo controls under the sticky header, which axe
  // reads as an obscured (too small) target. The page is checked at rest.
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    const serious = (await axeViolations(page)).filter((v) => /\((serious|critical)\)/.test(v));
    expect(serious, scheme).toEqual([]);
  }
});
