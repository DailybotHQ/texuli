import { expect, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * The docs shell demo pages (/docs-shell/), in the browser: the shell marks
 * the current page, the pager moves in reading order, the in-page contents
 * jump to their headings, and on a phone the disclosure menu lists the same
 * destinations. Its nav model is unit-tested in
 * scripts/tests/site-loaders.test.ts and its single "On this page" rule in
 * apps/website/tests/docs-reading.test.ts; axe runs in the page sweep.
 */

const origin = serveDist();

test('current page, pager, contents and the phone menu', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/docs-shell/`);
  await settle(page);
  await expect(page.locator('[data-tx-docs-shell] a[aria-current="page"]').first()).toHaveText(
    'Overview'
  );
  await page.locator('[data-tx-docs-toc] a[href="#static-and-local"]:visible').first().click();
  await expect(page).toHaveURL(/#static-and-local$/);
  await expect(page.locator('#static-and-local')).toBeInViewport();

  const pager = page.getByRole('navigation', { name: 'Page' });
  await pager.getByRole('link', { name: /Getting started/i }).click();
  await expect(page).toHaveURL(`${origin()}/docs-shell/getting-started/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
  await pager.getByRole('link', { name: /Navigation/i }).click();
  await expect(page).toHaveURL(`${origin()}/docs-shell/navigation/`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin()}/docs-shell/getting-started/`);
  await settle(page);
  const menu = page.locator('[data-tx-docs-mobile-nav]');
  await expect(menu).toBeVisible();
  await menu.locator('summary').click();
  await menu.getByRole('link', { name: 'Navigation' }).click();
  await expect(page).toHaveURL(`${origin()}/docs-shell/navigation/`);
  expect(foreign).toEqual([]);
});
