/// <reference types="node" />

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { SITE_NAV_GROUPS } from '../../apps/website/src/components/foundation/nav-data.ts';
import { GUIDES_SECTIONS } from '../../apps/website/src/components/guides/nav.ts';

/*
 * texuli.com information architecture (T-site-ia): a minimal landing on `/`
 * and one docs shell everywhere else (left sidebar with all navigation, slim
 * utility header, "On this page", pager, "Copy page"; a drawer on phones).
 * Built static site only; run `pnpm build` first. axe for every page is in
 * a11y-site.spec.ts; the sidebar details are in site-docs-nav.spec.ts.
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `pnpm build` before this spec.');
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

async function visit(page: Page, path: string): Promise<string[]> {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  return foreign;
}

/** Every built page route except the home and the 404. */
function docsRoutes(dir = DIST): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return docsRoutes(full);
    if (name !== 'index.html' || dir === DIST) return [];
    const route = `/${relative(DIST, dir).split('\\').join('/')}/`;
    // Isolated preview documents (loaded inside iframes) are bare by design: no docs shell.
    // /llms.txt/ is the built stub of the 301 redirect to /llms/llms.txt
    // (astro.config.mjs redirects): an endpoint, bare by design too.
    // /native/ is the second landing-shell route (T-32), asserted separately.
    return /\/preview\//.test(route) || route === '/llms.txt/' || landingRoutes().includes(route)
      ? []
      : [route];
  });
}

/** Landing-shell routes: the home and the native landing (T-32). */
function landingRoutes(): string[] {
  return ['/', '/native/'];
}

test.describe('landing', () => {
  test('a slim header: logo, Docs, the platform doors, search, theme and Get started; no sidebar', async ({
    page,
  }, info) => {
    expect(await visit(page, '/')).toEqual([]);
    const header = page.locator('[data-tx-site-header]');
    await expect(header).toHaveAttribute('data-variant', 'landing');
    await expect(header.getByRole('link', { name: 'Texuli home' })).toHaveAttribute('href', '/');
    await expect(header.getByRole('link', { name: 'Docs', exact: true })).toHaveAttribute(
      'href',
      '/guides/'
    );
    // The platform doors (T-32): the native landing and the architecture page,
    // hidden under 40rem where the hero calls to action carry the paths.
    await expect(header.getByRole('link', { name: 'Native', exact: true })).toHaveAttribute(
      'href',
      '/native/'
    );
    await expect(header.getByRole('link', { name: 'Web + native', exact: true })).toHaveAttribute(
      'href',
      '/web-and-native/'
    );
    await expect(header.locator('astro-island:not([ssr]) [data-tx-site-search]')).toBeVisible();
    await expect(header.getByRole('group', { name: 'Appearance' })).toBeVisible();
    const getStarted = header.getByRole('link', { name: 'Get started' });
    if (info.project.name === 'mobile') {
      // The hero's own call to action sits right below on phones.
      await expect(getStarted).toBeHidden();
    } else {
      await expect(getStarted).toHaveAttribute('href', '/guides/getting-started/');
    }
    // Only global utilities: the header lists no pages beyond the platform
    // doors and there is no docs chrome. Under 40rem only the logo and Docs
    // remain (the hero calls to action carry the paths).
    expect(await header.getByRole('link').count()).toBe(info.project.name === 'mobile' ? 2 : 5);
    await expect(page.locator('[data-tx-site-sidebar]')).toHaveCount(0);
    await expect(page.locator('[data-site-menu]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy page' })).toHaveCount(0);
  });

  test('the four unified sections mount in order with the footer and zero islands', async ({
    page,
  }) => {
    await visit(page, '/');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Interfaces from texels.');
    // The four blueprint sections (T-44) and nothing between them (the
    // agents CTA's module script rides inside the grid and is not content).
    const sections = await page
      .locator('[data-tx-landing] > *')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.tagName.toLowerCase())
          .filter((tag) => tag !== 'script')
      );
    expect(sections).toEqual(['section', 'section', 'section', 'section']);
    // The hero's theme moment is build-time data painted in the HTML.
    await expect(page.locator('[data-tx-hero-theme]')).toHaveCount(6);
    // No islands inside the landing content: the sections' scripts are
    // module scripts. The header chrome (SiteSearch, ThemeSwitch) hydrates
    // as on every page.
    await expect(page.locator('[data-tx-landing] astro-island')).toHaveCount(0);
    await expect(page.locator('[data-tx-web-agents]')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('fits a phone with no horizontal scroll', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone layout check');
    await visit(page, '/');
    const [scroll, viewport] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(viewport);
  });
});

test.describe('docs shell', () => {
  test('every other page carries the shell: sidebar, utility header, menu', ({
    browserName: _browser,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'reads the built HTML once');
    const routes = docsRoutes();
    expect(routes.length).toBeGreaterThan(150);
    const missing: string[] = [];
    for (const route of routes) {
      const html = readFileSync(join(DIST, route, 'index.html'), 'utf8');
      const header = html.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0] ?? '';
      const ok =
        html.includes('data-tx-site-sidebar') &&
        header.includes('data-variant="docs"') &&
        header.includes('data-site-menu') &&
        !/<nav\b/.test(header);
      if (!ok) missing.push(route);
    }
    expect(missing).toEqual([]);
  });

  test('the sidebar holds every group, with the guides in reading order', ({
    browserName: _browser,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'data check');
    expect(SITE_NAV_GROUPS.map((group) => group.label)).toEqual([
      'Get started',
      'Platform',
      'Components',
      'Primitives',
      'Themes',
      'Agents',
      'Project',
    ]);
    const guides = GUIDES_SECTIONS.flatMap((section) => section.items).map((item) => item.href);
    const getStarted = SITE_NAV_GROUPS[0]?.links.map((link) => link.href) ?? [];
    expect(getStarted).toEqual([...guides, '/skill/']);
  });

  test('the platform group holds the architecture page and the native landing', ({
    browserName: _browser,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'data check');
    const platform = SITE_NAV_GROUPS.find((group) => group.id === 'platform');
    expect(platform?.links.map((link) => link.href)).toEqual(['/web-and-native/', '/native/']);
    expect(platform?.expand).toBeUndefined();
  });

  test('every nav target resolves in the built site', ({ browserName: _browser }, info) => {
    test.skip(info.project.name !== 'chromium', 'data check');
    // Links without href are family headings; children nest one level.
    const flat = SITE_NAV_GROUPS.flatMap((group) =>
      group.links.flatMap((link) => [
        ...(link.href ? [link.href] : []),
        ...(link.children ?? []).flatMap((child) => (child.href ? [child.href] : [])),
      ])
    );
    const unresolved: string[] = [];
    for (const href of flat) {
      const dir = join(DIST, href.replace(/^\/+/, ''));
      if (!existsSync(join(dir, 'index.html')) && !existsSync(`${dir}.html`)) unresolved.push(href);
    }
    expect(unresolved).toEqual([]);
  });

  test('the native landing is one interaction from the home header', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the hero calls to action carry the paths');
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await visit(page, '/')).toEqual([]);
    await page
      .getByRole('navigation', { name: 'Platform' })
      .getByRole('link', { name: 'Native', exact: true })
      .click();
    await expect(page).toHaveURL(/\/native\/$/);
    // The native hero's h1 is the one-contract claim (T-45's content decision).
    await expect(page.locator('#native-hero-title')).toHaveText(
      'The same catalog, rendered by Compose.'
    );
  });

  test('a guide lives in the shell: one navigation, its group open, the shared pager', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'mobile', 'the sidebar is for wide screens');
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await visit(page, '/guides/theming/')).toEqual([]);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: /Guides/ })).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('list', { name: 'Get started' })).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Theming');
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
    const pager = page.getByRole('navigation', { name: 'Previous and next pages' });
    // The pager follows the sidebar's reading order; the why-svelte-kotlin
    // guide sits in Start between Getting started and Theming.
    await expect(pager.locator('a[rel="prev"]')).toHaveAttribute(
      'href',
      '/guides/why-svelte-kotlin/'
    );
    await expect(pager.locator('a[rel="next"]')).toHaveAttribute('href', '/guides/dark-mode/');
    await expect(page.getByRole('button', { name: 'Copy page' })).toBeVisible();
  });

  test('phones open the same navigation in the drawer, from any docs page', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'the drawer is the phone navigation');
    await visit(page, '/primitives-page/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer.getByRole('list', { name: 'Primitives' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });
});
