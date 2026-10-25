import type { Locator, Page } from '@playwright/test';

/**
 * The texuli.com primary navigation, wherever it is on this viewport: the
 * docs sidebar on wide screens (64rem and up), or the phone drawer, which
 * this opens (the menu button loads it on first press). Call it again after a
 * navigation: on phones the drawer closes with the old page.
 */
export async function primaryNav(page: Page): Promise<Locator> {
  const menu = page.locator('[data-site-menu]');
  if (await menu.isVisible()) {
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
    const drawer = page.locator('[data-tx-site-drawer]');
    await drawer.waitFor();
    return drawer.getByRole('navigation', { name: 'Primary' });
  }
  return page.getByRole('navigation', { name: 'Primary' });
}

/**
 * From the landing (`/`), which has no sidebar by design, follow the header's
 * Docs link into the docs shell, where the primary navigation lives.
 */
export async function enterDocsFromLanding(page: Page): Promise<void> {
  await page
    .locator('[data-tx-site-header]')
    .getByRole('link', { name: 'Docs', exact: true })
    .click();
  await page.waitForURL(/\/guides\/$/);
}

/**
 * The site search trigger in the header, on every viewport. Resolves once the
 * island has hydrated, so the trigger is interactive.
 */
export async function siteSearch(page: Page): Promise<Locator> {
  const search = page.locator(
    '[data-tx-site-header] astro-island:not([ssr]) [data-tx-site-search]'
  );
  await search.waitFor();
  return search;
}
