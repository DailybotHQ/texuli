import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists, solutionNavLinks } from '../../src/components/foundation/nav-data.ts';
import { LISTED_PRODUCTS } from '../../src/data/products/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const footer = readFileSync(resolve(WEBSITE, 'src/components/foundation/SiteFooter.astro'), 'utf8');

describe('footer ecosystem columns (ADR-031)', () => {
  it('keeps Native in the product row and adds Solutions and Built with Texuli from live routes only', () => {
    expect(footer).toContain(
      "PRODUCT_GROUP_IDS = ['components', 'primitives', 'themes', 'platform', 'agents']"
    );
    expect(footer).toContain("label = id === 'platform' ? 'Native'");
    expect(footer).toContain("href = id === 'platform' ? '/native/'");
    expect(footer).toContain('solutionNavLinks');
    expect(footer).toContain('siteRouteExists');
    expect(footer).toContain('LISTED_PRODUCTS');
    expect(footer).toContain('<h2>Solutions</h2>');
    // Native is linked once, from the product row (no duplicate column).
    expect(footer).not.toContain('<h2>Native</h2>');
    expect(footer).toContain('<h2>Built with Texuli</h2>');
    expect(footer).not.toMatch(/PLAN_015|Deep Work Plan/i);
  });

  it('lists a Solution or listed product only when its page exists', () => {
    const solutions = solutionNavLinks();
    expect(solutions.every((link) => link.href && siteRouteExists(link.href))).toBe(true);
    expect(siteRouteExists('/native/')).toBe(true);
    for (const product of LISTED_PRODUCTS) {
      const href = `/built-with/${product.id}/`;
      if (footer.includes(href)) expect(siteRouteExists(href), href).toBe(true);
    }
    expect(solutions.some((link) => link.href === '/solutions/')).toBe(
      siteRouteExists('/solutions/')
    );
    expect(footer.includes("siteRouteExists('/built-with/')")).toBe(true);
  });
});
