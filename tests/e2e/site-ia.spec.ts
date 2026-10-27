/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST, serveDist, settle } from './support/site.ts';

/*
 * texuli.com information architecture (T-site-ia), in the browser: a slim
 * landing header (logo, Docs, platform doors, GitHub, search, theme, Get
 * started; no sidebar) that collapses to logo and Docs on a phone, the native
 * landing one click from the home header, and a guide inside the docs shell
 * (one navigation, its group open, the shared pager); and every other built
 * page carries the docs shell (read from the built HTML). The groups and reading
 * order are unit-tested in apps/website/tests/docs-reading.test.ts; every
 * built nav target is checked by the link audit in site-seo.spec.ts.
 */

const origin = serveDist();
const DOORS = [
  { name: 'Web + native', href: '/web-and-native/' },
  { name: 'Native', href: '/native/' },
  { name: 'GitHub', href: 'https://github.com/DailybotHQ/texuli' },
];

/** Every built page route except the landings, the 404 and the bare preview documents. */
function docsRoutes(dir = DIST): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return docsRoutes(full);
    if (name !== 'index.html' || dir === DIST) return [];
    const route = `/${relative(DIST, dir).split('\\').join('/')}/`;
    return /\/preview\//.test(route) || ['/native/', '/404/'].includes(route) ? [] : [route];
  });
}

test('the landing header on desktop and phone, the native door, and a guide in the shell', async ({
  page,
}) => {
  // Every page but the landings carries the shell: sidebar, docs header, menu.
  const routes = docsRoutes();
  expect(routes.length).toBeGreaterThan(150);
  const bare = routes.filter((route) => {
    const html = readFileSync(join(DIST, route, 'index.html'), 'utf8');
    const header = html.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0] ?? '';
    return !(
      html.includes('data-tx-site-sidebar') &&
      header.includes('data-variant="docs"') &&
      header.includes('data-site-menu') &&
      !/<nav\b/.test(header)
    );
  });
  expect(bare).toEqual([]);

  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  for (const phone of [false, true]) {
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto(`${origin()}/`);
    await settle(page);
    const header = page.locator('[data-tx-site-header]');
    await expect(header).toHaveAttribute('data-variant', 'landing');
    await expect(header.getByRole('link', { name: 'Texuli home' })).toHaveAttribute('href', '/');
    await expect(header.getByRole('link', { name: 'Docs', exact: true })).toHaveAttribute(
      'href',
      '/guides/'
    );
    for (const door of DOORS) {
      const link = header.locator(`a[href="${door.href}"]`);
      await expect(link).toHaveText(door.name);
      if (phone) await expect(link).toBeHidden();
      else await expect(link).toBeVisible();
    }
    await expect(header.locator('astro-island:not([ssr]) [data-tx-site-search]')).toBeVisible();
    await expect(header.getByRole('group', { name: 'Appearance' })).toBeVisible();
    // Only global utilities: up to 48rem only the logo and Docs remain.
    expect(await header.getByRole('link').count()).toBe(phone ? 2 : 6);
    await expect(page.locator('[data-tx-site-sidebar]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy page' })).toHaveCount(0);
    if (phone) {
      // The hero carries the platform paths and the footer carries GitHub.
      for (const href of ['/native/', '/web-and-native/'])
        await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
      await expect(
        page.locator('footer a[href="https://github.com/DailybotHQ/texuli"]')
      ).toBeVisible();
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin()}/`);
  await settle(page);
  await page
    .getByRole('navigation', { name: 'Platform' })
    .getByRole('link', { name: 'Native', exact: true })
    .click();
  await expect(page).toHaveURL(/\/native\/$/);
  await expect(page.locator('#native-hero-title')).toHaveText(
    'The same catalog, rendered by Compose.'
  );

  await page.goto(`${origin()}/guides/theming/`);
  await settle(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole('list', { name: 'Get started' })).toBeVisible();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Theming');
  const pager = page.getByRole('navigation', { name: 'Previous and next pages' });
  await expect(pager.locator('a[rel="prev"]')).toHaveAttribute(
    'href',
    '/guides/why-svelte-kotlin/'
  );
  await expect(pager.locator('a[rel="next"]')).toHaveAttribute('href', '/guides/dark-mode/');
  expect(foreign).toEqual([]);
});
