import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com color explorer, in the browser: the mode switch repaints the
 * page, the export switches between CSS, JSON and Tailwind, and `/` focuses
 * the filter without typing into it (letters typed there stay text). The
 * explorer build and its exports are unit-tested in
 * scripts/tests/site-loaders.test.ts; axe runs in the page sweep.
 */

const origin = serveDist();

async function choose(page: Page, groupName: string, itemName: string) {
  const group = page.getByRole('group', { name: groupName });
  const item = group
    .getByRole('radio', { name: itemName })
    .or(group.getByRole('button', { name: itemName }));
  await item.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await item.click();
}

test('switches mode and export format, and `/` focuses the filter', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/color-explorer/`);
  await settle(page);
  const code = page.locator('[data-tx-color-explorer] pre code');
  await expect(code).toContainText('--tx-');

  await choose(page, 'Color mode', 'Dark');
  await expect(page.locator('html')).toHaveAttribute('data-tx-mode', 'dark', { timeout: 15_000 });
  await choose(page, 'Export format', 'JSON');
  await expect(code).toContainText('"id"', { timeout: 10_000 });
  await choose(page, 'Export format', 'Tailwind');
  await expect(code).toContainText('--color-', { timeout: 10_000 });

  await page.locator('[data-tx-explorer-keys] summary').focus();
  await page.keyboard.press('Slash');
  const filter = page.locator('#color-explorer-filter');
  await expect(filter).toBeFocused();
  await expect(filter).toHaveValue('');
  await page.keyboard.type('dl');
  await expect(filter).toHaveValue('dl');
  expect(foreign).toEqual([]);
});
