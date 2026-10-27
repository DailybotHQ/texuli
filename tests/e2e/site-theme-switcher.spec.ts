import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com theme switcher, in the browser: it lists the whole library,
 * each card paints its own primary swatch for the active mode, the mode and
 * theme apply to the page (the body really darkens), a search narrows the
 * list, and the choice persists across a reload with no flash. The catalog,
 * the filters and the swatch colors are unit-tested in
 * scripts/tests/site-loaders.test.ts and apps/website/tests/gallery.test.ts;
 * axe runs in the page sweep.
 */

const origin = serveDist();
const themeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-theme');
const modeAttr = (page: Page) => page.locator('html').getAttribute('data-tx-mode');
const bodyLuminance = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return -1;
    probe.fillStyle = getComputedStyle(document.body).backgroundColor;
    probe.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  });

async function clickMode(page: Page, name: string) {
  const group = page.getByRole('group', { name: 'Mode' });
  await group.getByRole('radio', { name }).or(group.getByRole('button', { name })).click();
}

test('lists and paints the library, switches theme and mode, filters, and persists with no flash', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${origin()}/theme-switcher/`);
  await settle(page);
  const options = page.getByRole('option');
  await expect.poll(() => options.count()).toBeGreaterThanOrEqual(200);

  // Two cards paint two different primaries, in the active mode's palette.
  const cards = page.locator('[data-tx-theme-switcher] [data-theme-id]');
  const colors = await Promise.all(
    [0, 1].map((index) =>
      cards.nth(index).evaluate((card) => {
        const chip =
          card.querySelector('.swatch-primary') ??
          card.querySelector('.swatch-row [title="primary"]') ??
          card.querySelector('.swatch-row .dot:nth-child(3)');
        return {
          declared: card
            .querySelector('[data-tx-swatch-primary]')
            ?.getAttribute('data-tx-swatch-primary'),
          painted: chip ? getComputedStyle(chip).backgroundColor : '',
        };
      })
    )
  );
  expect(colors[0]?.declared).toMatch(/^#/);
  expect(colors[0]?.declared?.toLowerCase()).not.toBe(colors[1]?.declared?.toLowerCase());
  expect(colors[0]?.painted).toBeTruthy();
  expect(colors[0]?.painted).not.toBe(colors[1]?.painted);
  await expect(page.locator('[data-swatch-mode]').first()).toHaveAttribute(
    'data-swatch-mode',
    'light'
  );

  await clickMode(page, 'Dark');
  expect(await modeAttr(page)).toBe('dark');
  expect(await bodyLuminance(page)).toBeLessThan(0.35);
  await expect(page.locator('[data-swatch-mode]').first()).toHaveAttribute(
    'data-swatch-mode',
    'dark'
  );
  await clickMode(page, 'High contrast');
  expect(await modeAttr(page)).toBe('high-contrast');
  await clickMode(page, 'Dark');

  const ocean = page.locator('[data-theme-id="ocean"]');
  const pick = (await ocean.count()) > 0 ? ocean : options.nth(2);
  const chosen = await pick.getAttribute('data-theme-id');
  await pick.click();
  await expect.poll(() => themeAttr(page), { timeout: 15_000 }).toBe(chosen);

  await page.getByLabel('Find a theme').fill('enterprise');
  await expect(page.locator('[data-theme-id="enterprise-neutral"]')).toBeVisible();

  // The no-flash script applies the stored theme and mode before first paint.
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
    chosen,
    'dark',
  ]);
  expect(await bodyLuminance(page)).toBeLessThan(0.35);
  expect(foreign).toEqual([]);
});
