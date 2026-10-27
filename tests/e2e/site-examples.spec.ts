import { expect, test } from '@playwright/test';
import { listExampleIds } from '../../packages/examples/src/index.ts';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com examples, in the browser: the listing renders every registered
 * example and filters; a card click-loads its isolated iframe preview, whose
 * frame toggles pass the mode on; full-page examples stay link-only; the
 * detail route loads the same iframe; and the standalone preview document is
 * interactive. The lanes and catalog are unit-tested in
 * apps/website/tests/gallery.test.ts and scripts/tests/site-loaders.test.ts;
 * axe runs in the page sweep.
 */

const origin = serveDist();

test('listing filters, click-to-load previews, detail route and standalone preview', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !/^(blob|data):/.test(url)) foreign.push(url);
  });
  await page.goto(`${origin()}/examples/`);
  await settle(page);
  await expect.poll(() => page.locator('[data-example-id]').count()).toBe(listExampleIds().length);

  const find = page.getByLabel('Find an example');
  await find.fill('texuli-button');
  const card = page.locator('[data-example-id="texuli-button"]');
  await card.getByRole('button', { name: 'Load live example' }).click();
  const slot = card.locator('[data-tx-example-iframe="texuli-button"]');
  await expect.poll(() => slot.getAttribute('data-active')).toBe('true');
  const frame = card.locator('[data-tx-example-frame]').first();
  const dark = frame
    .getByRole('group', { name: /color mode/i })
    .getByRole('button', { name: 'Dark', exact: true });
  await dark.scrollIntoViewIfNeeded();
  await dark.click();
  await expect(frame).toHaveAttribute('data-tx-mode', 'dark');
  await expect(slot.locator('iframe')).toHaveAttribute('src', /mode=dark/);
  await expect(slot.locator('iframe')).toHaveAttribute('src', /embed=1/);

  await find.fill('texuli-app-layouts');
  const full = page.locator('[data-example-id="texuli-app-layouts"]');
  await expect(full).toHaveAttribute('data-full-page', 'true');
  await expect(full.getByRole('link', { name: 'Open the live example' }).first()).toBeVisible();
  await expect(full.locator('iframe')).toHaveCount(0);

  await page.goto(`${origin()}/examples/texuli-button/`);
  await settle(page);
  await page.getByRole('button', { name: 'Load live example' }).click();
  const iframe = page.locator('[data-tx-example-iframe="texuli-button"] iframe');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('title', /Live example/);

  await page.goto(`${origin()}/examples/preview/texuli-button/?embed=0`);
  const host = page.locator('[data-tx-example-preview-host="texuli-button"]');
  await expect.poll(() => host.getAttribute('data-loaded')).toBe('true');
  await expect(host).toHaveAttribute('data-embed', 'false');
  await host.getByRole('button', { name: 'Default' }).first().click();
  expect(foreign).toEqual([]);
});
