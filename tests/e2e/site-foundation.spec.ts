import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';
import { primaryNav } from './support/site-nav.ts';

/*
 * texuli.com foundation, in the browser: routing marks the current page in
 * the sidebar, the skip link moves focus to main, the site follows the
 * system scheme from the first paint, and the appearance switch persists a
 * choice with no flash (System clears it). The appearance helpers are
 * unit-tested in apps/website/tests/gallery.test.ts and
 * scripts/tests/site-loaders.test.ts.
 */

const origin = serveDist();
const mode = (page: Page) => page.locator('html').getAttribute('data-tx-mode');
/** Relative luminance of the body background (0 black, 1 white). */
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

test('routing marks the page, the skip link reaches main, the scheme and appearance hold with no flash', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/guides/`);
  await settle(page);
  const nav = await primaryNav(page);
  await expect(nav.getByRole('link', { name: 'Introduction', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await nav.getByRole('link', { name: 'Foundation', exact: true }).click();
  await expect(page).toHaveURL(`${origin()}/foundation/`);
  await settle(page);
  const primary = await primaryNav(page);
  await expect(primary.getByRole('link', { name: 'Foundation', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(
    primary.getByRole('link', { name: 'Introduction', exact: true })
  ).not.toHaveAttribute('aria-current', /.*/);
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await skip.focus();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${origin()}/`);
    await settle(page);
    expect(await mode(page)).toBe(scheme);
    if (scheme === 'dark') expect(await bodyLuminance(page)).toBeLessThan(0.1);
    else expect(await bodyLuminance(page)).toBeGreaterThan(0.8);
  }

  const switcher = page.getByRole('group', { name: 'Appearance' });
  const pick = (name: string) =>
    switcher.getByRole('radio', { name }).or(switcher.getByRole('button', { name })).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await settle(page);
  await pick('Dark');
  expect(await mode(page)).toBe('dark');
  // The no-flash script applies the cached mode before any stylesheet or island.
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive')
        (window as unknown as { early?: string | null }).early =
          document.documentElement.getAttribute('data-tx-mode');
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { early?: string }).early)).toBe('dark');
  await settle(page);
  await pick('System');
  expect(await mode(page)).toBe('light');
  await page.reload();
  expect(await mode(page)).toBe('light');
  expect(foreign).toEqual([]);
});
