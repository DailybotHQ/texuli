import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectLiveStage } from './support/live-stage.ts';
import { serveDist, settle } from './support/site.ts';

/*
 * Component pages (/component-pages/<id>/), in the browser: the props panel
 * drives the live code sample, the dropdown menu stage is real Texuli menu
 * chrome, and a sample of one page per family passes axe under forced
 * colors. The per-page check (the stage is ready, its marker part is on
 * screen, axe in light and dark) runs in the page sweep, a11y-site.spec.ts;
 * the marker registry and the evidence loaders are unit-tested in
 * scripts/tests/site-loaders.test.ts, and the page sections and controls in
 * apps/website/tests/component-pages.test.ts.
 */

const origin = serveDist();
/** One component per family for the forced-colors sample. */
const FAMILY_SAMPLES = [
  'button',
  'dropdown-menu',
  'layout-sidebar',
  'table',
  'media-image',
  'blocks-text',
];

test('props panel drives the code, the menu stage is interactive, families pass axe in forced colors', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/component-pages/badge/`);
  await settle(page);
  const demo = page.locator('[data-tx-live-demo="badge"]').first();
  // Wait for hydration: a click on the server-rendered panel is lost.
  await expect(page.locator('astro-island[component-url*="LiveDemo"]:not([ssr])')).not.toHaveCount(
    0
  );
  await demo
    .getByRole('radio', { name: 'outline' })
    .or(demo.getByRole('button', { name: 'outline' }))
    .first()
    .click();
  await expect(demo.locator('[data-tx-code-sample] code')).toContainText('outline');

  await page.goto(`${origin()}/component-pages/dropdown-menu/`);
  await expectLiveStage(page, 'dropdown-menu');
  const trigger = page
    .locator('[data-tx-live-stage="dropdown-menu"]')
    .first()
    .locator('[data-tx-dropdown-menu-trigger]')
    .first();
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  // The stage check may have opened it already: the trigger toggles either way.
  const was = await trigger.getAttribute('aria-expanded');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', was === 'true' ? 'false' : 'true');
  if (was !== 'true') {
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  }

  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  for (const id of FAMILY_SAMPLES) {
    await page.goto(`${origin()}/component-pages/${id}/`);
    await expectLiveStage(page, id);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${id} ${v.id}: ${v.help}`)).toEqual([]);
  }
  expect(foreign).toEqual([]);
});
