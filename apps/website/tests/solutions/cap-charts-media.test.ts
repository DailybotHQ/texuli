import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';

const chartsPage = readFileSync(resolve('apps/website/src/pages/charts-page/index.astro'), 'utf8');
const mediaPage = readFileSync(resolve('apps/website/src/pages/media-page/index.astro'), 'utf8');
const chartsPackage = JSON.parse(readFileSync(resolve('packages/charts/package.json'), 'utf8')) as {
  version: string;
};
const mediaPackage = JSON.parse(readFileSync(resolve('packages/media/package.json'), 'utf8')) as {
  version: string;
};

describe('Charts and Media capability family pages', () => {
  it('labels both pages as capability families and reports the published pre-1.0 package versions', () => {
    expect(chartsPage).toContain('<p class="taxonomy">Capability family</p>');
    expect(mediaPage).toContain('<p class="taxonomy">Capability family</p>');
    expect(chartsPage).toContain('{chartsPackage.version} · pre-1.0');
    expect(mediaPage).toContain('{mediaPackage.version} · pre-1.0');
    expect(chartsPage).toContain('Available on npm');
    expect(mediaPage).toContain('Available on npm');
    expect(chartsPackage.version).toMatch(/^0\./);
    expect(mediaPackage.version).toMatch(/^0\./);
  });

  it('keeps charts a component family and links to the real Dashboards reference and live Solutions', () => {
    expect(chartsPage).toContain('A chart family, not a dashboard builder');
    expect(chartsPage).toContain('not a complete dashboard builder');
    expect(chartsPage).toContain("href: '/dashboards-page/'");
    expect(chartsPage).toContain("href: '/solutions/slides/'");
    expect(chartsPage).toContain("href: '/solutions/'");
    expect(chartsPage).toContain('.filter((item) => siteRouteExists(item.href))');
    for (const route of ['/dashboards-page/', '/solutions/slides/', '/solutions/']) {
      expect(siteRouteExists(route), route).toBe(true);
      expect(existsSync(resolve('apps/website/src/pages', route.slice(1), 'index.astro'))).toBe(
        true
      );
    }
  });

  it('keeps Media a broad component family and links to live Solutions that use media', () => {
    expect(mediaPage).toContain('Media inside larger Solutions');
    expect(mediaPage).toContain('host-provided generator');
    expect(mediaPage).toContain("href: '/solutions/slides/'");
    expect(mediaPage).toContain("href: '/solutions/canvas/'");
    expect(mediaPage).toContain("href: '/solutions/'");
    expect(mediaPage).toContain('.filter((item) => siteRouteExists(item.href))');
    for (const route of ['/solutions/slides/', '/solutions/canvas/', '/solutions/']) {
      expect(siteRouteExists(route), route).toBe(true);
    }
  });

  it('preserves the existing family demos and is honest about product boundaries', () => {
    expect(chartsPage).toContain('CHART_FAMILIES.map((family) => (');
    expect(chartsPage).toContain('<FamilyDemo id={family.id} client:visible />');
    expect(mediaPage).toContain('<MediaLab client:load />');
    expect(mediaPage).toContain('synthetic fixtures');
    for (const page of [chartsPage, mediaPage]) {
      expect(page).not.toMatch(/PLAN_015|ADR-A/);
      expect(page).not.toMatch(/coming soon|full dashboard builder|complete media studio/i);
    }
  });
});
