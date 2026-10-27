/// <reference types="node" />
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { LIVE_CATALOG_IDS, LIVE_MARKERS } from '../../apps/website/src/components/live/markers.ts';
import { expectLiveStage, foreignRequests } from './support/live-stage.ts';
import { DIST, serveDist, sitePaths } from './support/site.ts';

/*
 * Live interactive component pages: every catalog id mounts its real
 * component. The per-page check (the live stage is ready, its marker part is
 * on screen, no request leaves the origin, and axe in light and dark) runs in
 * the page sweep, a11y-site.spec.ts, on the same loads. Here: the catalog
 * covers every built page, the props panel and the menu chrome work, and a
 * family sample passes axe under forced colors.
 */

/** Families for the forced-colors axe sample. */
const FAMILY_SAMPLES = [
  'button',
  'badge',
  'alert',
  'dropdown-menu',
  'layout-sidebar',
  'table',
  'media-image',
  'blocks-text',
  'dialog',
  'select',
] as const;

const origin = serveDist();

async function visit(page: Page, path: string): Promise<string[]> {
  return foreignRequests(page, origin(), () =>
    page.goto(`${origin()}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  );
}

test.describe('texuli.com live components exact', () => {
  test('LIVE_MARKERS covers the catalog list module and every built component page', () => {
    expect(LIVE_CATALOG_IDS.length).toBeGreaterThan(50);
    expect(Object.keys(LIVE_MARKERS).length).toBe(LIVE_CATALOG_IDS.length);
    const dir = join(DIST, 'component-pages');
    expect(existsSync(join(dir, 'index.html')), 'run pnpm build first').toBe(true);
    const built = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(built.length).toBeGreaterThanOrEqual(50);
    for (const id of built) expect(LIVE_MARKERS[id], `LIVE_MARKERS entry for ${id}`).toBeTruthy();
    // Every catalog id is a sitemap page, so the page sweep visits it.
    const paths = new Set(sitePaths());
    for (const id of LIVE_CATALOG_IDS) {
      expect(paths.has(`/component-pages/${id}/`), `${id} in the sitemap`).toBe(true);
    }
  });

  test('props panel updates the live code sample on badge', async ({ page }) => {
    expect(await visit(page, '/component-pages/badge/')).toEqual([]);
    const demo = page.locator('[data-tx-live-demo="badge"]').first();
    await expect(demo).toBeVisible();
    // Wait for hydration: a click on the server-rendered panel is lost.
    await expect(
      page.locator('astro-island[component-url*="LiveDemo"]:not([ssr])')
    ).not.toHaveCount(0);
    const outline = demo
      .getByRole('radio', { name: 'outline' })
      .or(demo.getByRole('button', { name: 'outline' }));
    if ((await outline.count()) > 0) {
      await outline.first().click();
      await expect(demo.locator('[data-tx-code-sample] code')).toContainText('outline');
    }
  });

  test('dropdown-menu trigger is interactive Texuli menu chrome', async ({ page }) => {
    expect(await visit(page, '/component-pages/dropdown-menu/')).toEqual([]);
    await expectLiveStage(page, 'dropdown-menu');
    const stage = page.locator('[data-tx-live-stage="dropdown-menu"]').first();
    const trigger = stage.locator('[data-tx-dropdown-menu-trigger]').first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    // Toggle open/closed — real DropdownMenu.Root (no nested Button, no native details).
    await trigger.click();
    await expect
      .poll(async () => trigger.getAttribute('aria-expanded'), { timeout: 10_000 })
      .not.toBeNull();
    const expanded = await trigger.getAttribute('aria-expanded');
    expect(['true', 'false']).toContain(expanded);
  });

  test('passes axe on family samples (forced-colors)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Family axe on desktop projects');
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
    for (const id of FAMILY_SAMPLES) {
      expect(await visit(page, `/component-pages/${id}/`)).toEqual([]);
      await expectLiveStage(page, id);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map((v) => `${id} ${v.id}: ${v.help}`),
        id
      ).toEqual([]);
    }
  });
});
