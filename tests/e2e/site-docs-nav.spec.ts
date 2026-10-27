/// <reference types="node" />

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { COMPONENT_PAGES } from '../../apps/website/src/components/component-pages/load-manifests.ts';
import { fillPageMarkdown } from '../../apps/website/src/components/docs/integration.ts';
import { htmlToMarkdown } from '../../apps/website/src/components/docs/markdown.ts';
import {
  isDocsPath,
  navSections,
  pagerFor,
  SITE_NAV_GROUPS,
  SITE_NAV_ORDER,
} from '../../apps/website/src/components/foundation/nav-data.ts';
import { PRIMITIVES } from '../../apps/website/src/components/primitives-page/primitives.ts';

/*
 * texuli.com docs chrome (FIX-site-sidebar-nav): the slim header, the grouped
 * sidebar built from `foundation/site.ts` and the catalog, the lazy phone
 * drawer, "On this page", the pager and "Copy page". Built static site only;
 * run `pnpm build` first. axe for every page is in a11y-site.spec.ts.
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
};
const BUTTON = '/component-pages/button/';

let server: Server;
let origin = '';

test.beforeAll(async () => {
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

async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
}

test.describe('navigation model', () => {
  test.beforeEach(({ browserName: _browser }, info) => {
    test.skip(info.project.name !== 'chromium', 'the data checks are browser-independent');
  });

  test('groups come from site.ts, with every component and primitive', () => {
    expect(SITE_NAV_GROUPS.map((group) => group.label)).toEqual([
      'Get started',
      // The platform group (architecture page + native landing) since T-32.
      'Platform',
      'Components',
      'Primitives',
      'Themes',
      'Agents',
      'Project',
    ]);
    const getStarted = SITE_NAV_GROUPS[0]?.links.map((link) => link.href) ?? [];
    expect(getStarted[0]).toBe('/guides/');
    expect(getStarted.at(-1)).toBe('/skill/');
    // The home is a landing outside the docs navigation.
    expect(SITE_NAV_ORDER.some((link) => link.href === '/')).toBe(false);
    expect(SITE_NAV_ORDER.some((link) => link.href.startsWith('/migration'))).toBe(false);

    const hrefs = new Set(SITE_NAV_ORDER.map((link) => link.href));
    for (const entry of COMPONENT_PAGES) expect(hrefs).toContain(`/component-pages/${entry.id}/`);
    for (const doc of PRIMITIVES) expect(hrefs).toContain(`/primitives-page/${doc.id}/`);

    // Components are grouped by family (site-ia.md: Overview, Gallery,
    // Examples, Blocks, Charts, Media, then every catalog component): the
    // catalog pages are one nested, alphabetically sorted level per family.
    const componentLinks =
      SITE_NAV_GROUPS.find((group) => group.id === 'components')?.links.filter(
        (link) => link.children
      ) ?? [];
    const labels = componentLinks.flatMap((family) =>
      (family.children ?? []).map((child) => child.label)
    );
    for (const family of componentLinks) {
      const childLabels = (family.children ?? []).map((child) => child.label);
      expect(childLabels).toEqual([...childLabels].sort((a, b) => a.localeCompare(b, 'en')));
    }
    expect(labels).toHaveLength(COMPONENT_PAGES.length);
    expect(new Set(labels).size).toBe(COMPONENT_PAGES.length);
  });

  test('current page, section state, pager order and docs layout', () => {
    const button = navSections('', BUTTON).flatMap((section) => section.items);
    // The page sits one nested level under its family heading (site nav is
    // grouped by family): the heading carries the "section" state through
    // the nested page, which stays the one "page".
    const currentFamily = button.find(
      (item) => item.current === 'section' && item.children?.some((child) => child.current)
    );
    expect(currentFamily?.children?.filter((child) => child.current)).toEqual([
      { label: 'Button', href: BUTTON, current: 'page' },
    ]);
    // A page without its own link marks its nearest listed ancestor.
    const dashboard = navSections('/base', '/showcase/dashboard/').flatMap((s) => s.items);
    expect(dashboard.filter((item) => item.current)).toEqual([
      { label: 'Showcase', href: '/base/showcase/', current: 'section' },
    ]);

    const index = SITE_NAV_ORDER.findIndex((link) => link.href === BUTTON);
    expect(pagerFor(BUTTON)).toEqual({
      previous: SITE_NAV_ORDER[index - 1],
      next: SITE_NAV_ORDER[index + 1],
    });
    expect(pagerFor('/guides/')).toEqual({ next: SITE_NAV_ORDER[1] });
    expect(pagerFor('/')).toEqual({});
    expect(pagerFor('/not-listed/')).toEqual({});

    expect(isDocsPath(BUTTON)).toBe(true);
    expect(isDocsPath('/guides/install/')).toBe(true);
    expect(isDocsPath('/gallery-components/')).toBe(false);
    expect(isDocsPath('/')).toBe(false);
  });

  test('the Markdown rendition keeps content and drops controls and hidden text', () => {
    const markdown = htmlToMarkdown(`
      <h2 id="a">Usage &amp; notes</h2>
      <p>Read the <a href="/guides/">guides</a> and use <code>texuli add</code>.</p>
      <p>Render <code>&lt;Button&gt;</code> for an &lt;a&gt; link.</p>
      <pre><code>pnpm add texuli</code></pre>
      <ul><li>One</li><li><strong>Two</strong></li></ul>
      <table><tr><th>Prop</th><th>Type</th></tr><tr><td>size</td><td>sm | md</td></tr></table>
      <button>Copy page</button><script>alert(1)</script>
      <div aria-hidden="true">decoration</div><p hidden>secret</p>`);
    expect(markdown).toContain('## Usage & notes');
    expect(markdown).toContain('Read the [guides](/guides/) and use `texuli add`.');
    expect(markdown).toContain('```\npnpm add texuli\n```');
    // Escaped text survives as text: it is never mistaken for a tag.
    expect(markdown).toContain('Render `<Button>` for an <a> link.');
    expect(markdown).toContain('- One\n- **Two**');
    expect(markdown).toContain('| Prop | Type |');
    for (const dropped of ['Copy page', 'alert(1)', 'decoration', 'secret']) {
      expect(markdown).not.toContain(dropped);
    }
  });

  test('the build fills each page template with escaped Markdown of its body only', () => {
    const page = `<main><template data-page-markdown="" data-x>Head\n</template><!--tx-page-body--><h2>A &lt;b&gt; tag</h2><p>x</p><!--/tx-page-body--><nav>Pager</nav></main>`;
    const filled = fillPageMarkdown(page) ?? '';
    expect(filled).toContain('<template data-page-markdown="" data-x>Head\n## A &lt;b&gt; tag');
    expect(filled).not.toContain('tx-page-body');
    expect(filled).not.toMatch(/<template[^>]*>[^<]*Pager/);
    expect(fillPageMarkdown('<main><p>No template</p></main>')).toBeNull();
  });
});

test.describe('wide screens', () => {
  test.beforeEach(({ browserName: _browser }, info) => {
    test.skip(info.project.name === 'mobile', 'the sidebar and the TOC are for wide screens');
  });

  test('skip link first, sidebar marks the page, header search, no extra islands', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, BUTTON);
    // WebKit, like Safari's default setting, reaches links only with Alt+Tab.
    await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(page.locator(':focus')).toHaveText('Skip to content');

    await expect(page.locator('[data-site-menu]')).toBeHidden();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    const current = nav.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Button');
    await expect(current).toBeInViewport();
    await expect(nav.getByRole('list', { name: 'Components' })).toContainText('Button');
    await expect(nav.getByRole('link', { name: 'Migration' })).toHaveCount(0);

    await expect(page.locator('[data-tx-site-header] [data-tx-site-search]')).toBeVisible();
    // The shell hydrates the search and the theme switch only: the sidebar,
    // TOC, pager and copy button are static (page demos are the page's own).
    await expect(page.locator('[data-tx-site-header] astro-island')).toHaveCount(2);
    for (const chrome of [
      '[data-tx-site-sidebar]',
      '[data-page-toc]',
      '[data-docs-pager]',
      '[data-copy-page]',
    ]) {
      await expect(page.locator(`${chrome} astro-island`)).toHaveCount(0);
    }
  });

  test('"On this page" lists the headings and follows the scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, BUTTON);
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc).toBeVisible();
    const h2s = await page.locator('main h2').allTextContents();
    await expect(toc.getByRole('link', { name: h2s[1]?.trim() ?? '' })).toBeVisible();

    const props = toc.getByRole('link', { name: 'Props', exact: true });
    await props.click();
    await expect(page).toHaveURL(/#cp-props$/);
    await expect(props).toHaveAttribute('aria-current', 'true');
  });

  test('the pager follows the sidebar order', async ({ page }) => {
    await open(page, BUTTON);
    const { previous, next } = pagerFor(BUTTON);
    const pager = page.getByRole('navigation', { name: 'Previous and next pages' });
    await expect(pager.locator('a[rel="prev"]')).toHaveAttribute('href', previous?.href ?? '');
    await expect(pager.locator('a[rel="prev"]')).toContainText(previous?.label ?? '');
    await expect(pager.locator('a[rel="next"]')).toHaveAttribute('href', next?.href ?? '');
    await expect(pager.locator('a[rel="next"]')).toContainText(next?.label ?? '');
  });

  test('"Copy page" puts the Markdown rendition on the clipboard', async ({
    page,
    context,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'WebKit refuses clipboard read to automation');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, BUTTON);
    await page.getByRole('button', { name: 'Copy page' }).click();
    await expect(page.locator('[data-copy-page-status]')).toHaveText('Page copied as Markdown.');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.startsWith('# ')).toBe(true);
    expect(text).toContain('## Props');
    expect(text).not.toContain('Copy page');
  });

  test('wide pages keep the wide layout without docs chrome', async ({ page }) => {
    await open(page, '/gallery-components/');
    await expect(page.locator('.site-content')).toHaveAttribute('data-layout', 'wide');
    await expect(page.getByRole('button', { name: 'Copy page' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Previous and next pages' })).toHaveCount(0);
  });
});

test.describe('phones', () => {
  test.beforeEach(({ browserName: _browser }, info) => {
    test.skip(info.project.name !== 'mobile', 'the drawer is the phone navigation');
  });

  test('the menu loads the drawer on first press, traps focus, closes on Escape', async ({
    page,
  }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await open(page, BUTTON);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    const loadedBefore = scripts.length;
    const islands = await page.locator('astro-island').count();

    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    expect(scripts.length).toBeGreaterThan(loadedBefore);
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator('astro-island').count()).toBe(islands);

    const nav = drawer.getByRole('navigation', { name: 'Primary' });
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Button');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    // The navigation went back to the page, once.
    await expect(page.locator('[data-site-nav]')).toHaveCount(1);

    await menu.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Close navigation' }).click();
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('the header fits the phone, with search and the theme switch', async ({ page }) => {
    await open(page, '/');
    await expect(page.getByRole('button', { name: /Search/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /theme|appearance/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth)
    );
  });
});
