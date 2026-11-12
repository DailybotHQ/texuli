import { expect, test } from '@playwright/test';
import { axeViolations, serveDist, settle } from './support/site.ts';

const origin = serveDist();

test('emoji component page: search, grid keyboard, categories, recents and axe light/dark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/emoji/`);
  await settle(page);

  const picker = page.locator('[data-tx-emoji-demo] [data-tx-emoji-picker]').first();
  const search = picker.getByRole('combobox', { name: 'Search emoji' });
  await search.fill('rocket');
  await expect(picker.getByRole('gridcell', { name: 'rocket' })).toBeVisible();
  await search.fill('');
  const grid = picker.getByRole('grid', { name: 'All' });
  await grid.focus();
  const initial = await grid.getAttribute('aria-activedescendant');
  await page.keyboard.press('ArrowRight');
  await expect(grid).not.toHaveAttribute('aria-activedescendant', initial ?? '');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tx-emoji-demo] [aria-live="polite"]')).toContainText(
    'Selected:'
  );

  await picker.getByRole('option', { name: 'Recent' }).click();
  await expect(picker.getByRole('gridcell')).toHaveCount(1);
  await picker.getByRole('option', { name: 'People' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(picker.getByRole('option', { name: 'Animals and nature' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await picker.getByRole('radio', { name: 'Medium skin tone' }).check();

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    expect(await axeViolations(page), colorScheme).toEqual([]);
  }
  expect(foreign).toEqual([]);
});
