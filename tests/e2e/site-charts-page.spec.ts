import { expect, test } from '@playwright/test';
import { CHART_FAMILIES } from '../../apps/website/src/components/charts-page/families.ts';
import { serveDist, settle } from './support/site.ts';
import { enterDocsFromLanding, primaryNav } from './support/site-nav.ts';

/*
 * texuli.com charts gallery, in the browser: the sidebar reaches it, every
 * family's live demo mounts on the index without a request leaving the
 * origin, and the interaction demo reports its legend and selection state.
 * The family catalog (ids, imports, contracts) is unit-tested in
 * scripts/tests/site-loaders.test.ts; axe runs in the page sweep.
 */

const origin = serveDist();

test('the sidebar reaches the gallery, every family demo mounts, the interaction demo reports state', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/`);
  await settle(page);
  await enterDocsFromLanding(page);
  await (await primaryNav(page)).getByRole('link', { name: 'Charts', exact: true }).click();
  await expect(page).toHaveURL(`${origin()}/charts-page/`);
  await settle(page);
  for (const family of CHART_FAMILIES) {
    const demo = page.locator(`[data-tx-charts-demo="${family.id}"]`);
    await demo.scrollIntoViewIfNeeded();
    await expect(demo, family.id).toBeVisible({ timeout: 15_000 });
  }

  await page.goto(`${origin()}/charts-page/interaction/`);
  await settle(page);
  await expect(page.locator('[data-tx-charts-demo="interaction"]')).toBeVisible();
  await expect(page.locator('[data-tx-charts-selection]')).toContainText('Selection:');
  await expect(page.locator('[data-tx-charts-domain]')).toContainText('Full range');
  expect(foreign).toEqual([]);
});
