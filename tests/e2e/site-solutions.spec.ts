import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com Solutions foundation (catalog, ADR-031 landing nav, footer columns, landing
 * section order), on the built site (`pnpm build` first):
 *
 * 1. /solutions/ lists every registry card, and the All / Web / Native filters work
 *    without JavaScript;
 * 2. /solutions/index.json is the registry document;
 * 3. the landing header lists ADR-031 items on desktop and in the 390 px menu;
 * 4. the footer Solutions and Built with columns link only existing routes;
 * 5. every /solutions/<slug>/ landing renders the nine sections in order.
 *
 * Copy and registry facts are unit-tested in apps/website/tests/solutions/*.test.ts.
 */

const origin = serveDist();
const SLUGS = ['slides', 'documents', 'workflows', 'canvas', 'sheets'] as const;
const SECTIONS = [
  'hero',
  'demo',
  'stories',
  'how',
  'quickstart',
  'recipes',
  'agents',
  'platforms',
  'next',
] as const;
const GLOBAL_NAV = [
  'Solutions',
  'Components',
  'Native',
  'Themes',
  'Agents',
  'Docs',
  'GitHub',
] as const;

async function globalLabels(page: Page): Promise<string[]> {
  return page
    .locator('[data-tx-site-header] [data-global-nav] a')
    .evaluateAll((links) => links.map((link) => (link.textContent ?? '').trim()));
}

test('/solutions/ lists every card and the All, Web and Native filters work', async ({ page }) => {
  const response = await page.goto(`${origin()}/solutions/`);
  expect(response?.status()).toBe(200);
  await settle(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Complete systems, built from small pieces.'
  );
  const catalog = page.locator('[data-tx-solutions-catalog]');
  const cards = catalog.locator('[data-solution]');
  await expect(cards).toHaveCount(SLUGS.length);
  expect(
    await cards.evaluateAll((all) => all.map((el) => el.getAttribute('data-solution')))
  ).toEqual([...SLUGS]);
  for (const slug of SLUGS) {
    const card = catalog.locator(`[data-solution="${slug}"]`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-on-web', 'true');
    await expect(card).toHaveAttribute('data-on-native', 'false');
    await expect(card.getByRole('link', { name: /Explore /i })).toHaveAttribute(
      'href',
      `/solutions/${slug}/`
    );
  }

  const filters = page.getByRole('navigation', { name: 'Filter Solutions by platform' });
  await expect(filters.getByRole('link', { name: /All/ })).toBeVisible();
  await expect(filters.getByRole('link', { name: /Web/ })).toBeVisible();
  await expect(filters.getByRole('link', { name: /Native/ })).toBeVisible();

  await filters.getByRole('link', { name: /Web/ }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#solutions-web');
  for (const slug of SLUGS)
    await expect(catalog.locator(`[data-solution="${slug}"]`)).toBeVisible();

  await filters.getByRole('link', { name: /Native/ }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#solutions-native');
  for (const slug of SLUGS) await expect(catalog.locator(`[data-solution="${slug}"]`)).toBeHidden();
  await expect(catalog.getByText('No Solution renders natively yet')).toBeVisible();

  await filters.getByRole('link', { name: /All/ }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#solutions-all');
  for (const slug of SLUGS)
    await expect(catalog.locator(`[data-solution="${slug}"]`)).toBeVisible();
});

test('/solutions/index.json is the registry document', async () => {
  const response = await fetch(`${origin()}/solutions/index.json`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/application\/json/);
  const doc = (await response.json()) as {
    format: string;
    catalog: string;
    solutions: Array<{ slug: string; status: string; docs: string | null; url: string }>;
    products: Array<{ id: string }>;
  };
  expect(doc.format).toBe('texuli/solutions-index-v1');
  expect(doc.catalog).toBe('https://texuli.com/solutions/');
  expect(doc.solutions.map((row) => row.slug)).toEqual([...SLUGS]);
  for (const row of doc.solutions) {
    expect(row.status).toBe('in development');
    expect(row.url).toBe(`https://texuli.com/solutions/${row.slug}/`);
    expect(row.docs).toBe(`https://texuli.com/guides/solutions/${row.slug}/`);
  }
  expect(doc.products.map((row) => row.id)).toEqual(['protoyard']);
});

test('the landing header lists ADR-031 items on desktop and in the 390 px menu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin()}/solutions/`);
  await settle(page);
  const header = page.locator('[data-tx-site-header]');
  await expect(header).toHaveAttribute('data-variant', 'landing');
  await expect(header.getByRole('navigation', { name: 'Global' })).toBeVisible();
  await expect(header.locator('[data-landing-menu]')).toBeHidden();
  expect(await globalLabels(page)).toEqual([...GLOBAL_NAV]);
  await expect(header.getByRole('link', { name: 'Solutions', exact: true })).toHaveAttribute(
    'href',
    '/solutions/'
  );
  await expect(header.getByRole('link', { name: 'Native', exact: true })).toHaveAttribute(
    'href',
    '/native/'
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin()}/solutions/`);
  await settle(page);
  const menu = header.locator('[data-landing-menu]');
  await expect(menu).toBeVisible();
  await expect(header.getByRole('navigation', { name: 'Global' })).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(header.locator('[data-global-nav]')).toHaveAttribute('data-open', '');
  await expect(header.getByRole('navigation', { name: 'Global' })).toBeVisible();
  expect(await globalLabels(page)).toEqual([...GLOBAL_NAV]);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(header.getByRole('navigation', { name: 'Global' })).toBeHidden();
});

test('the footer Solutions and Built with columns link only existing routes', async ({ page }) => {
  await page.goto(`${origin()}/solutions/`);
  await settle(page);
  const footer = page.locator('[data-tx-site-footer]');
  const solutions = footer.locator('.site-footer__column', {
    has: page.getByRole('heading', { name: 'Solutions', exact: true }),
  });
  const built = footer.locator('.site-footer__column', {
    has: page.getByRole('heading', { name: 'Built with Texuli', exact: true }),
  });
  await expect(solutions.getByRole('link', { name: 'Explore all' })).toHaveAttribute(
    'href',
    '/solutions/'
  );
  for (const slug of SLUGS) {
    const name = slug[0]?.toUpperCase() + slug.slice(1);
    await expect(solutions.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      `/solutions/${slug}/`
    );
  }
  await expect(built.getByRole('link', { name: 'Explore all' })).toHaveAttribute(
    'href',
    '/built-with/'
  );
  await expect(built.getByRole('link', { name: 'Protoyard' })).toHaveAttribute(
    'href',
    '/built-with/protoyard/'
  );

  const hrefs = await footer
    .locator('.site-footer__columns a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href.startsWith('/solutions/') || href.startsWith('/built-with/'), href).toBe(true);
    const response = await fetch(`${origin()}${href}`);
    expect(response.status, href).toBe(200);
  }
});

test('every Solutions landing renders the nine sections in order', async ({ page }) => {
  for (const slug of SLUGS) {
    const response = await page.goto(`${origin()}/solutions/${slug}/`);
    expect(response?.status(), slug).toBe(200);
    await settle(page);
    const landing = page.locator(`[data-solution="${slug}"]`);
    await expect(landing).toHaveAttribute('data-solution-status', 'in development');
    const sections = landing.locator('[data-solution-section]');
    await expect(sections, slug).toHaveCount(SECTIONS.length);
    expect(
      await sections.evaluateAll((all) =>
        all.map((el) => el.getAttribute('data-solution-section'))
      ),
      slug
    ).toEqual([...SECTIONS]);
    for (const id of [
      'overview',
      'demo',
      'features',
      'how-it-works',
      'quickstart',
      'recipes',
      'agents',
      'platforms',
      'next-steps',
    ]) {
      await expect(page.locator(`[id="${id}"]`), `${slug} #${id}`).toHaveCount(1);
    }
  }
});
