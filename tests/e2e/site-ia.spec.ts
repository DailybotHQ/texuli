/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST, serveDist, settle } from './support/site.ts';

/*
 * texuli.com information architecture, in the browser: the ADR-031 landing
 * header (Solutions · Components · Native · Themes · Agents · Docs · GitHub)
 * inline on desktop and in a keyboard menu at 390 px, the native landing one
 * click from that header, a guide inside the docs shell (one navigation, its
 * group open, the shared pager); docs pages carry the shell and landings carry
 * the landing header (read from the built HTML). The groups and reading order
 * are unit-tested in apps/website/tests/docs-reading.test.ts; every built nav
 * target is checked by the link audit in site-seo.spec.ts.
 */

const origin = serveDist();
const GLOBAL_NAV = [
  { name: 'Solutions', href: '/solutions/' },
  { name: 'Components', href: '/component-pages/' },
  { name: 'Native', href: '/native/' },
  { name: 'Themes', href: '/gallery-themes/' },
  { name: 'Agents', href: '/agents-page/' },
  { name: 'Docs', href: '/guides/' },
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
  // Docs pages carry the shell. Landings (home, /native/, /solutions/…, /built-with/…)
  // carry the ADR-031 header and no sidebar.
  const routes = docsRoutes();
  expect(routes.length).toBeGreaterThan(150);
  const misclassified = routes.filter((route) => {
    const html = readFileSync(join(DIST, route, 'index.html'), 'utf8');
    const header = html.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0] ?? '';
    const landing = header.includes('data-variant="landing"');
    if (landing) {
      return !(
        header.includes('data-global-nav') &&
        header.includes('data-landing-menu') &&
        !html.includes('data-tx-site-sidebar')
      );
    }
    return !(
      html.includes('data-tx-site-sidebar') &&
      header.includes('data-variant="docs"') &&
      header.includes('data-site-menu') &&
      !/<nav\b/.test(header)
    );
  });
  expect(misclassified).toEqual([]);

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
    const nav = header.getByRole('navigation', { name: 'Global' });
    const menu = header.locator('[data-landing-menu]');
    if (phone) {
      await expect(menu).toBeVisible();
      await expect(nav).toBeHidden();
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(nav).toBeVisible();
    } else {
      await expect(menu).toBeHidden();
      await expect(nav).toBeVisible();
    }
    for (const item of GLOBAL_NAV) {
      await expect(nav.getByRole('link', { name: item.name, exact: true })).toHaveAttribute(
        'href',
        item.href
      );
    }
    await expect(header.locator('astro-island:not([ssr]) [data-tx-site-search]')).toBeVisible();
    await expect(header.getByRole('group', { name: 'Appearance' })).toBeVisible();
    await expect(page.locator('[data-tx-site-sidebar]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy page' })).toHaveCount(0);
    if (phone) {
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
    .locator('[data-tx-site-header]')
    .getByRole('navigation', { name: 'Global' })
    .getByRole('link', { name: 'Native', exact: true })
    .click();
  await expect(page).toHaveURL(/\/native\/$/);
  await expect(page.locator('#native-hero-22-title')).toHaveText(
    'Your interface language, beyond the browser.'
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
