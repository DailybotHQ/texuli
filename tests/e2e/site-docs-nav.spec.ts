import { expect, test } from '@playwright/test';
import { pagerFor } from '../../apps/website/src/components/foundation/nav-data.ts';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com docs chrome (FIX-site-sidebar-nav), in the browser: on a wide
 * screen the skip link comes first, the sidebar marks and shows the page,
 * only the header search and theme switch hydrate, "On this page" follows a
 * jump, the pager follows the sidebar order and "Copy page" puts the
 * Markdown on the clipboard; on a phone the menu loads the drawer on first
 * press, traps focus and closes on Escape. The navigation model and the
 * Markdown rendition are unit-tested in apps/website/tests/docs-reading.test.ts.
 */

const origin = serveDist();
const BUTTON = '/component-pages/button/';

test('wide screens: skip link, sidebar, static chrome, TOC, pager and Copy page; phones: the drawer', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin()}${BUTTON}`);
  await settle(page);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText('Skip to content');
  await expect(page.locator('[data-site-menu]')).toBeHidden();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveText('Button');
  await expect(current).toBeInViewport();
  // The shell hydrates the search and the theme switch only.
  await expect(page.locator('[data-tx-site-header] astro-island')).toHaveCount(2);
  for (const chrome of [
    '[data-tx-site-sidebar]',
    '[data-page-toc]',
    '[data-docs-pager]',
    '[data-copy-page]',
  ])
    await expect(page.locator(`${chrome} astro-island`)).toHaveCount(0);

  const toc = page.getByRole('navigation', { name: 'On this page' });
  await expect(toc).toHaveCount(1);
  const props = toc.getByRole('link', { name: 'Props', exact: true });
  await props.click();
  await expect(page).toHaveURL(/#cp-props$/);
  await expect(props).toHaveAttribute('aria-current', 'true');

  const { previous, next } = pagerFor(BUTTON);
  const pager = page.getByRole('navigation', { name: 'Previous and next pages' });
  await expect(pager.locator('a[rel="prev"]')).toHaveAttribute('href', previous?.href ?? '');
  await expect(pager.locator('a[rel="next"]')).toHaveAttribute('href', next?.href ?? '');

  await page.getByRole('button', { name: 'Copy page' }).click();
  await expect(page.locator('[data-copy-page-status]')).toHaveText('Page copied as Markdown.');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith('# ')).toBe(true);
  expect(text).toContain('## Props');
  expect(text).not.toContain('Copy page');

  // Phones: the drawer.
  await page.setViewportSize({ width: 390, height: 844 });
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto(`${origin()}${BUTTON}`);
  await settle(page);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(0);
  const loadedBefore = scripts.length;
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeVisible();
  expect(scripts.length).toBeGreaterThan(loadedBefore);
  await expect(
    drawer.getByRole('navigation', { name: 'Primary' }).locator('[aria-current="page"]')
  ).toHaveText('Button');
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(page.locator('[data-site-nav]')).toHaveCount(1);
  await menu.click();
  await drawer.getByRole('button', { name: 'Close navigation' }).click();
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
});
