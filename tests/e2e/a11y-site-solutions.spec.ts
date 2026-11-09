import { expect, test } from '@playwright/test';
import { axeViolations, expectMode, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * Every route the Solutions work added (ADR-027 to ADR-031), not one sample per group:
 * axe with zero exclusions in light, dark and forced colors, and the polish check
 * (no overflow, no escaping element, no broken image, no stand-in copy), at desktop
 * and phone width. The landings' demo islands are also driven in their own specs
 * (site-solution-<slug>.spec.ts). Run `pnpm build` first.
 */

const ROUTES = [
  '/solutions/',
  '/solutions/slides/',
  '/solutions/documents/',
  '/solutions/workflows/',
  '/solutions/canvas/',
  '/solutions/sheets/',
  '/guides/solutions/slides/',
  '/guides/solutions/documents/',
  '/guides/solutions/workflows/',
  '/guides/solutions/canvas/',
  '/guides/solutions/sheets/',
  '/built-with/',
  '/built-with/protoyard/',
  '/native/',
  '/native/compatibility/',
];

const origin = serveDist();

for (const route of ROUTES) {
  test(`${route}: axe in light, dark and forced colors; polish at 1280 and 390 px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const mode of ['light', 'dark', 'high-contrast'] as const) {
      await page.emulateMedia({
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        forcedColors: mode === 'high-contrast' ? 'active' : 'none',
        reducedMotion: 'reduce',
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${origin()}${route}`);
      await settle(page);
      if (mode !== 'high-contrast') await expectMode(page, mode);
      expect(await axeViolations(page), `${route} ${mode}`).toEqual([]);
      if (mode === 'light') {
        expect(await polishProblems(page), `${route} desktop`).toEqual([]);
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await polishProblems(page), `${route} phone`).toEqual([]);
        expect(await page.locator('h1').count(), `${route} h1`).toBe(1);
      }
    }
  });
}
