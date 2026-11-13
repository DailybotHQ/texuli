import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * The Rich text editor Solution landing (PLAN_023 T-sol-editor) on the built site: fixture
 * documents read from Markdown and written back, the block-type menu (one undo step), HTML paste
 * that drops a javascript: link and a script, Paste as Markdown, the emoji button and the
 * export to chat dialects with the losses listed. Nothing is saved or sent.
 */

const origin = serveDist();
const ROUTE = '/solutions/editor/';
const demo = (page: Page) => page.locator('[data-tx-editor-demo]');
const editor = (page: Page) => demo(page).getByRole('textbox', { name: 'Demo document' });
const markdownOut = (page: Page) => demo(page).locator('[data-tx-editor-demo-out]');
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

/**
 * Put the caret at the end of the closing paragraph: focus it with a click, then collapse the DOM
 * selection to its end (the editor follows selectionchange; End does not move the caret under
 * touch emulation).
 */
async function caretAtEnd(page: Page): Promise<void> {
  const line = editor(page).locator('p', { hasText: 'Questions? Reply in' });
  await line.click();
  await line.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
}

async function openDemo(page: Page): Promise<void> {
  await page.goto(`${origin()}${ROUTE}`);
  await settle(page);
  await demo(page).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr]) [data-tx-editor-demo]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(editor(page)).toBeVisible();
}

test('the editor landing renders its registry status, honest copy and one island', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const response = await page.goto(`${origin()}${ROUTE}`);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? '';
  expect(html).toContain('data-tx-solution-status="in development"');
  // 0.18.0 published the editor extras: the package notes name that release.
  expect(html).toContain('HTML paste through @texuli/core/html released in 0.18.0');
  expect(html).not.toContain('not in a published release yet');
  expect(html).toMatch(/<astro-island[^>]+client="visible"/);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Rich text that reads and writes Markdown, and travels to any chat.'
  );
  await expect(page.locator('astro-island:has([data-tx-editor-demo])')).toHaveCount(1);
  // /editor-page/ stays as the capability reference (ADR-036): linked, not redirected.
  await expect(page.locator('a[href="/editor-page/"]').first()).toBeAttached();
  const reference = await page.request.get(`${origin()}/editor-page/`, { maxRedirects: 0 });
  expect(reference.status()).toBe(200);
  expect(await problems()).toEqual([]);
});

test('a document loads from Markdown, changes kind from the menu in one undo step, and writes back', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await openDemo(page);
  await demo(page).getByRole('button', { name: 'Support macro' }).click();
  await expect(editor(page).getByRole('heading', { name: 'Password reset' })).toBeVisible();
  await expect(markdownOut(page)).toContainText('## Password reset');

  // Put the caret in the first step and make it a heading from the text style menu.
  await editor(page).getByText('Enter the email on your account').click();
  const menuButton = demo(page).getByRole('button', { name: 'Text style: Numbered list' });
  await menuButton.click();
  const menu = page.getByRole('menu', { name: 'Text style: Numbered list' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitemradio', { name: /Heading 3/ }).click();
  await expect(markdownOut(page)).toContainText('### Enter the email on your account');
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(markdownOut(page)).not.toContainText('### Enter the email');

  // Markdown in: raw HTML stays text, a refused link keeps its text.
  await demo(page)
    .getByLabel('Markdown source')
    .fill('# From an agent\n\nSee <b>this</b> and [that](javascript:alert(1)).');
  await demo(page).getByRole('button', { name: 'Load into the editor' }).click();
  await expect(editor(page).getByRole('heading', { name: 'From an agent' })).toBeVisible();
  await expect(editor(page)).toContainText('See <b>this</b> and that.');
  await expect(editor(page).getByRole('link')).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('pasted HTML drops the script and the javascript: link; Paste as Markdown reads structure', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await openDemo(page);
  await demo(page).getByRole('button', { name: 'Meeting note' }).click();
  await demo(page).getByRole('button', { name: 'Paste the HTML' }).click();
  await expect(demo(page).locator('[data-tx-editor-demo-paste-note]')).toContainText(
    'One link was refused by the URL policy (javascript:)'
  );
  await expect(editor(page).getByRole('heading', { name: 'Q4 planning' })).toBeVisible();
  await expect(editor(page).getByRole('link', { name: 'plan' })).toHaveAttribute(
    'href',
    'https://example.com/plan'
  );
  await expect(editor(page).getByRole('link', { name: 'this link' })).toHaveCount(0);
  expect(await editor(page).innerHTML()).not.toMatch(/onclick|steal|<script|javascript:/i);

  await demo(page).getByRole('button', { name: 'Paste text as Markdown' }).click();
  await expect(editor(page).getByRole('heading', { name: 'Launch checklist' })).toBeVisible();
  await expect(markdownOut(page)).toContainText('- [x] **Docs** are live');
  expect(await problems()).toEqual([]);
});

test('the emoji button and a :shortcode: insert emoji, each one undo step', async ({ page }) => {
  const problems = await watchProblems(page);
  await openDemo(page);
  await demo(page).getByRole('button', { name: 'Release notes' }).click();
  await caretAtEnd(page);
  // The shortcode lookup loads with the emoji catalog on first focus.
  await expect(demo(page).locator('[data-shortcodes="ready"]')).toBeAttached({ timeout: 20_000 });
  await page.keyboard.type(' :tada:');
  await expect(markdownOut(page)).toContainText('#northwind-pilot. 🎉', { timeout: 20_000 });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(markdownOut(page)).toContainText('#northwind-pilot. :tada:');

  await demo(page).getByRole('button', { name: 'Emoji' }).click();
  const dialog = page.getByRole('dialog', { name: 'Insert emoji' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Search emoji' }).fill('rocket');
  const rocket = dialog.getByRole('gridcell', { name: /rocket/i }).first();
  await expect(rocket).toBeVisible({ timeout: 20_000 });
  await rocket.click();
  await expect(dialog).toBeHidden();
  await expect(markdownOut(page)).toContainText('🚀');
  expect(await problems()).toEqual([]);
});

test('the export writes each chat format, lists its losses and never pings', async ({ page }) => {
  const problems = await watchProblems(page);
  await openDemo(page);
  await demo(page).getByRole('button', { name: 'Release notes' }).click();
  const region = demo(page).getByRole('region', { name: 'Export for chat' });
  const slack = region.getByRole('textbox', { name: 'Slack text' });
  await expect(slack).toHaveValue(/<https:\/\/example\.com\/docs\/views\|dashboard>/);
  await expect(slack).toHaveValue(/- ☑ Saved views/);
  await expect(region.getByText('Headings are unsupported by this dialect.')).toBeVisible();

  await region.getByRole('combobox', { name: 'Format' }).click();
  await page.getByRole('option', { name: 'Discord' }).click();
  const discord = region.getByRole('textbox', { name: 'Discord text' });
  await expect(discord).toHaveValue(/^## Northwind 2\.4 release notes/);

  // Typed broadcast words never become pings.
  await caretAtEnd(page);
  await page.keyboard.type(' @everyone');
  await expect(discord).toHaveValue(/@\u200beveryone/);
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
