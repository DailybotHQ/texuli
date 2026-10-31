import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';
import { siteSearch } from './support/site-nav.ts';

/*
 * texuli.com search, in the browser: the search page answers a query; the
 * header trigger and ⌘/Ctrl+K load the command palette on first use only,
 * then toggle it; the palette opens centered in both directions and finds
 * docs; and a page with results passes axe in light and dark (the bare
 * /search/ page is in the page sweep). The index and ranking are unit-tested
 * in scripts/tests/site-loaders.test.ts.
 */

const origin = serveDist();

test('query results, the lazy palette by shortcut and trigger, centered in ltr and rtl, axe clean', async ({
  page,
}) => {
  const foreign: string[] = [];
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto(`${origin()}/`);
  await settle(page);
  await siteSearch(page);
  // Only the trigger ships with the page: the palette and its index wait for a search.
  expect(scripts.some((url) => /SitePalette/.test(url))).toBe(false);
  // Nor does the palette's code ride in a shared chunk: importing the `Command`
  // namespace object for its trigger once put CommandPalette and its dialog
  // stack on every page (about 22.5 KB gzip), whatever the chunk was named.
  for (const url of scripts) {
    expect(await (await page.request.get(url)).text(), url).not.toContain(
      'tx-command-palette__content'
    );
  }
  const dialog = page.getByRole('dialog', { name: 'Search Texuli' });
  await page.keyboard.press('ControlOrMeta+k');
  await expect(dialog).toBeVisible();
  expect(scripts.some((url) => /SitePalette/.test(url))).toBe(true);
  await dialog.locator('input').first().fill('overview');
  await expect(dialog.getByText(/Overview/i).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(dialog).toBeHidden();

  for (const dir of ['ltr', 'rtl'] as const) {
    await page.goto(`${origin()}/component-pages/`);
    await settle(page);
    await page.evaluate((value) => document.documentElement.setAttribute('dir', value), dir);
    await (await siteSearch(page)).locator('button').click();
    const panel = page.locator('.tx-command-palette__content').first();
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    // The popover UA style (inset: 0; margin: auto) once pushed it 32px off center.
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2), dir).toBeLessThanOrEqual(1);
  }

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${origin()}/search/?q=button`);
    await settle(page);
    await expect(page.locator('[data-tx-search-query]')).toHaveText('button');
    await expect(
      page.locator('[data-tx-search-page] a').filter({ hasText: 'Button' }).first()
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${scheme} ${v.id}`)).toEqual([]);
  }
  expect(foreign).toEqual([]);
});
