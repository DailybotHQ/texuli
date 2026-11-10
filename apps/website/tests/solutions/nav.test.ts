import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ecosystemNavGroups,
  LANDING_NAV,
  LANDING_NAV_CONTRACT,
  siteRouteExists,
  solutionNavLinks,
} from '../../src/components/foundation/nav-data.ts';
import { REPOSITORY_URL } from '../../src/components/foundation/site.ts';
import { SOLUTION_SLUGS } from '../../src/data/solutions/schema.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const header = readFileSync(resolve(WEBSITE, 'src/components/foundation/SiteHeader.astro'), 'utf8');

describe('ADR-031 landing nav contract', () => {
  it('names the seven items in order with the decided hrefs', () => {
    expect(LANDING_NAV_CONTRACT.map((item) => [item.label, item.href])).toEqual([
      ['Solutions', '/solutions/'],
      ['Components', '/component-pages/'],
      ['Native', '/native/'],
      ['Themes', '/gallery-themes/'],
      ['Agents', '/agents-page/'],
      ['Docs', '/guides/'],
      ['GitHub', REPOSITORY_URL],
    ]);
    expect(LANDING_NAV_CONTRACT[6]?.external).toBe(true);
  });

  it('ships only items whose pages exist, so desktop and phone share one list', () => {
    expect(LANDING_NAV.every((item) => LANDING_NAV_CONTRACT.includes(item))).toBe(true);
    expect(LANDING_NAV.map((item) => item.label)).toEqual(
      LANDING_NAV_CONTRACT.filter(
        (item) => item.external === true || siteRouteExists(item.href)
      ).map((item) => item.label)
    );
    for (const item of LANDING_NAV) {
      if (item.external) continue;
      expect(siteRouteExists(item.href), item.href).toBe(true);
    }
    expect(LANDING_NAV.some((item) => item.label === 'Components')).toBe(true);
    expect(LANDING_NAV.some((item) => item.label === 'Native')).toBe(true);
    expect(LANDING_NAV.some((item) => item.label === 'Themes')).toBe(true);
    expect(LANDING_NAV.some((item) => item.label === 'Agents')).toBe(true);
    expect(LANDING_NAV.some((item) => item.label === 'Docs')).toBe(true);
    expect(LANDING_NAV.some((item) => item.label === 'GitHub')).toBe(true);
    expect(LANDING_NAV.some((item) => item.label === 'Solutions')).toBe(
      siteRouteExists('/solutions/')
    );
  });

  it('lists promoted Solutions only when their landings exist', () => {
    expect(SOLUTION_SLUGS).toEqual([
      'slides',
      'documents',
      'workflows',
      'canvas',
      'sheets',
      'design-systems',
    ]);
    const links = solutionNavLinks();
    for (const slug of SOLUTION_SLUGS) {
      const href = `/solutions/${slug}/`;
      expect(links.some((link) => link.href === href)).toBe(siteRouteExists(href));
    }
    // The sidebar keeps one compact group: the catalog and Built with Texuli (budget note in nav-data.ts).
    const sidebar = ecosystemNavGroups();
    expect(sidebar.map((group) => group.id)).toEqual(['solutions']);
    expect(sidebar[0]?.links.map((link) => link.href)).toEqual(
      ['/solutions/', '/built-with/'].filter((href) => siteRouteExists(href))
    );
  });
});

describe('landing header (desktop + phone)', () => {
  it('renders LANDING_NAV as one Global nav and a keyboard menu below 64rem', () => {
    expect(header).toContain('LANDING_NAV');
    expect(header).toContain('aria-label="Global"');
    expect(header).toContain('data-landing-menu');
    expect(header).toContain('data-global-nav');
    expect(header).toContain('aria-controls="tx-global-nav"');
    expect(header).toContain("safeHref(REPOSITORY_URL, 'developer')");
    expect(header).toContain("event.key !== 'Escape'");
    expect(header).toContain('@media (max-width: 64rem)');
    expect(header).not.toMatch(/\.global-nav:hover/);
    expect(header).not.toContain("'https://github.com/DailybotHQ/texuli'");
  });
});
