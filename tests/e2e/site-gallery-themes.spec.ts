import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com theme gallery, in the browser: cards render 24 at a time with
 * live previews and scores, two cards paint different primaries, the card
 * preview mode re-scopes the previews only, a search narrows the list, and
 * one-click apply persists theme and mode with no flash. The scores, filters
 * and deep links are unit-tested in scripts/tests/site-loaders.test.ts and
 * apps/website/tests/gallery.test.ts; axe runs in the page sweep.
 */

const origin = serveDist();
const themeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-theme');
const modeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-mode');

test('pages, paints and filters live cards, and applies a theme with no flash', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${origin()}/gallery-themes/`);
  await settle(page);
  const cards = page.locator('[data-theme-id]');
  await expect(cards).toHaveCount(24);
  await expect(page.getByRole('status').first()).toContainText(/2\d\d themes/);
  await page.getByRole('button', { name: 'Show 24 more', exact: true }).click();
  await expect(cards).toHaveCount(48);
  const first = cards.first();
  await expect(first.locator('[data-preview-surface]')).toBeVisible();
  await expect(first.locator('.scores .score-row')).toHaveCount(3);
  const primaries = await Promise.all(
    [0, 1].map((index) =>
      cards
        .nth(index)
        .locator('[data-tx-swatch-primary]')
        .first()
        .getAttribute('data-tx-swatch-primary')
    )
  );
  expect(primaries[0]).toMatch(/^#/);
  expect(primaries[0]?.toLowerCase()).not.toBe(primaries[1]?.toLowerCase());

  const preview = page.getByRole('group', { name: 'Card preview mode' });
  await preview
    .getByRole('radio', { name: 'Dark' })
    .or(preview.getByRole('button', { name: 'Dark' }))
    .click();
  await expect(first.locator('[data-preview-surface]')).toHaveAttribute('data-tx-mode', 'dark');
  expect(await modeAttr(page)).toBe('light');

  await page.getByLabel('Find a theme').fill('enterprise');
  await expect(page.locator('[data-theme-id="enterprise-neutral"]')).toBeVisible();
  await page.getByLabel('Find a theme').fill('');

  const violet = page.locator('[data-theme-id="violet"]');
  const target = (await violet.count()) > 0 ? violet : cards.nth(1);
  const id = await target.getAttribute('data-theme-id');
  await target.locator('[data-apply-mode="dark"]').click();
  expect(await themeAttr(page)).toBe(id);
  expect(await modeAttr(page)).toBe('dark');
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        const root = document.documentElement;
        (window as unknown as { early?: string[] }).early = [
          root.getAttribute('data-tx-theme') ?? '',
          root.getAttribute('data-tx-mode') ?? '',
        ];
      }
    });
  });
  await page.reload();
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { early?: string[] }).early)).toEqual([
    id,
    'dark',
  ]);
  expect(foreign).toEqual([]);
});
