import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /solutions/documents/ (the Documents Solution landing), on the built site
 * (`pnpm build` first), following the Slides landing spec:
 *
 * 1. the page: one h1, the registry status, the subnav anchors, the static reader preview
 *    in the server HTML before any script runs, no console errors and no CSP violations;
 * 2. the demo island: it hydrates when scrolled into view, Start loads the editor; adding
 *    a block and renaming the title work from the keyboard, Undo and Redo walk the
 *    history, the read view swaps in the reader, Reset returns to the starting report,
 *    View source shows the document as plain JSON;
 * 3. the Markdown twin at /solutions/documents.md;
 * 4. at 390 px nothing overflows; axe finds no serious or critical violation in light or dark.
 *
 * Copy and content are unit-tested in apps/website/tests/solutions/documents-*.test.ts.
 */

const origin = serveDist();
const ROUTE = '/solutions/documents/';
const TITLE = 'Lumen quarterly product report';

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

const demo = (page: Page) => page.locator('[data-tx-documents-demo]');
const island = (page: Page) => page.locator('astro-island:has([data-tx-documents-demo])');
const status = (page: Page) => demo(page).locator('.documents-controls__status');
const controls = (page: Page) =>
  demo(page).getByRole('group', { name: 'Document example controls' });

/** The block count the demo announces ("… N blocks."). */
async function announcedBlocks(page: Page): Promise<number> {
  const text = (await status(page).textContent()) ?? '';
  const match = /(\d+) blocks\./.exec(text);
  if (!match) throw new Error(`no block count in "${text}"`);
  return Number(match[1]);
}

/** Scrolls the demo into view, waits for hydration, and starts the editor. */
async function startDemo(page: Page): Promise<void> {
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-documents-demo]')).toBeVisible({
    timeout: 20_000,
  });
  await demo(page).getByRole('button', { name: 'Start interactive demo' }).click();
  await expect(controls(page)).toBeVisible({ timeout: 20_000 });
  await expect(status(page)).toContainText(`${TITLE} is ready`);
}

test('the landing renders its sections, status and server preview, with no errors', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  // The static preview and the hero are in the server HTML, before hydration.
  expect(html).toContain('data-tx-documents-demo-preview="product-report"');
  expect(html).toContain('data-tx-solution-status="in development"');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Documents you can edit, read and export.'
  );
  await expect(page.locator('[data-tx-solution-status]')).toHaveText(/Status: in development/);
  await expect(page.locator('[data-tx-documents-demo-preview]')).toBeVisible();
  // The island has not hydrated while it is below the fold.
  await expect(island(page)).toHaveAttribute('ssr', '');

  const subnav = page.getByRole('navigation', { name: 'Documents page sections' });
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
  await expect(page.locator('a[href*="/documents-page/"]')).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('the demo hydrates on scroll; add, rename, undo, redo, read view, reset and source work', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems = await watchProblems(page);
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await startDemo(page);
  await expect(demo(page).getByRole('textbox').first()).toBeVisible();

  // Add a heading block, by keyboard.
  await controls(page).getByRole('combobox', { name: 'Add a block' }).selectOption('heading');
  await controls(page).getByRole('button', { name: 'Add block' }).focus();
  await page.keyboard.press('Enter');
  await expect(status(page)).toContainText('Block added');
  const added = await announcedBlocks(page);

  // Rename the title from the keyboard (Enter submits the form).
  const title = controls(page).getByRole('textbox', { name: 'Document title' });
  await title.fill('Lumen product report, revised');
  await title.press('Enter');
  await expect(status(page)).toContainText('Title updated. Lumen product report, revised.');

  // Undo walks back the rename, then the block; Redo restores the block.
  const undo = controls(page).getByRole('button', { name: 'Undo demo change' });
  const redo = controls(page).getByRole('button', { name: 'Redo demo change' });
  await undo.click();
  await expect(status(page)).toContainText(`Last change undone. ${TITLE}.`);
  await undo.click();
  await expect(status(page)).toContainText('Last change undone');
  expect(await announcedBlocks(page)).toBe(added - 1);
  await redo.click();
  await expect(status(page)).toContainText('Change restored');
  expect(await announcedBlocks(page)).toBe(added);

  // The read view swaps the editor for the reader, and back.
  const readView = controls(page).getByRole('button', { name: 'Read view' });
  await readView.click();
  await expect(status(page)).toContainText('Read view opened');
  await expect(controls(page).getByRole('button', { name: 'Edit view' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(demo(page).getByRole('heading', { name: TITLE }).first()).toBeVisible();
  await controls(page).getByRole('button', { name: 'Edit view' }).click();
  await expect(status(page)).toContainText('Edit view opened');

  // Reset returns to the starting report.
  await controls(page).getByRole('button', { name: 'Reset example' }).click();
  await expect(status(page)).toContainText(`Example reset. ${TITLE}.`);
  expect(await announcedBlocks(page)).toBe(added - 1);
  await expect(undo).toBeDisabled();

  // View source shows the document as plain text, not markup.
  await controls(page).getByRole('button', { name: 'View source' }).click();
  const source = demo(page).getByRole('region', { name: 'Document source as JSON' });
  await expect(source).toBeVisible();
  const text = (await source.locator('pre code').textContent()) ?? '';
  expect(JSON.parse(text).meta.title).toBe(TITLE);
  expect(await source.locator('pre code *').count()).toBe(0);

  expect(await problems()).toEqual([]);
});

test('the Markdown twin carries the landing', async () => {
  const response = await fetch(`${origin()}/solutions/documents.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const body = await response.text();
  expect(body).toContain('Documents you can edit, read and export.');
  expect(body).toContain('https://texuli.com/solutions/documents/');
  expect(body).toContain('Status: in development');
  expect(body).toContain('document.run');
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
  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    const serious = (await axeViolations(page)).filter((v) => /\((serious|critical)\)/.test(v));
    expect(serious, scheme).toEqual([]);
  }
});
