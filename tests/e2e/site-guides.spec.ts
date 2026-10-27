import { expect, type Locator, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';
import { primaryNav } from './support/site-nav.ts';

/*
 * Guides (apps/website/src/pages/guides), in the browser: the sidebar marks
 * the page, the pager walks the reading order, and the live snippets mount
 * and respond (a button, form validation, a direction switch). The reading
 * order, guide islands and contents are unit-tested in
 * apps/website/tests/docs-reading.test.ts and copy-honesty.test.ts; axe runs
 * in the page sweep.
 */

const origin = serveDist();

async function open(page: Page, path: string) {
  await page.goto(`${origin()}${path}`);
  await settle(page);
}

/** Center the target, so the sticky header does not intercept the click. */
async function tap(locator: Locator) {
  await locator.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

test('the pager walks the reading order and the live snippets respond', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await open(page, '/guides/');
  await expect((await primaryNav(page)).locator('a[aria-current="page"]')).toHaveText(
    'Introduction'
  );
  const pager = page.getByRole('navigation', { name: 'Previous and next pages' });
  await tap(pager.getByRole('link', { name: /Getting started/i }));
  await expect(page).toHaveURL(`${origin()}/guides/getting-started/`);
  await settle(page);
  const live = page.locator('[data-guide-live="getting-started"]');
  await tap(live.getByRole('button', { name: 'Try the button' }));
  await expect(live.getByRole('button', { name: /Clicked 1/ })).toBeVisible();
  await tap(pager.getByRole('link', { name: /Why Svelte and Kotlin/i }));
  await expect(page).toHaveURL(`${origin()}/guides/why-svelte-kotlin/`);

  await open(page, '/guides/forms/');
  const form = page.locator('[data-guide-live="forms"]');
  await tap(form.getByRole('button', { name: 'Save profile' }));
  await expect(form.getByText('Enter at least two characters.')).toBeVisible();
  await form.getByLabel('Display name').fill('Alex');
  await form.getByLabel('Email').fill('alex@example.com');
  await tap(form.getByRole('button', { name: 'Save profile' }));
  await expect(form.locator('[data-guide-form-saved]')).toBeVisible();

  await open(page, '/guides/rtl-i18n/');
  const rtl = page.locator('[data-guide-live="rtl-i18n"]');
  await expect(rtl.locator('[data-guide-dir="rtl"]')).toBeVisible();
  await tap(rtl.getByRole('button', { name: 'LTR' }));
  await expect(rtl.locator('[data-guide-dir="ltr"]')).toBeVisible();
  expect(foreign).toEqual([]);
});
