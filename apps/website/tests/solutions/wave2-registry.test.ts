import { describe, expect, it } from 'vitest';
import { siteRouteExists, solutionNavLinks } from '../../src/components/foundation/nav-data.ts';
import { catalogCards } from '../../src/components/solutions/catalog/catalog-content.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';
import { checkSolutionRegistry, SOLUTION_SLUGS } from '../../src/data/solutions/schema.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import { solutionsIndexDocument } from '../../src/lib/twins/solutions.ts';

const WAVE2 = ['dashboards', 'forms', 'agent-chat', 'editor'] as const;

describe('ADR-036 second Solutions batch', () => {
  it('registers the four Solutions in catalog order after the first wave', () => {
    expect([...SOLUTION_SLUGS]).toEqual([...SOLUTIONS.map((entry) => entry.slug)]);
    expect(SOLUTION_SLUGS.slice(-4)).toEqual([...WAVE2]);
    expect(checkSolutionRegistry(SOLUTIONS)).toEqual([]);
    expect(validateSolutionRegistry(SOLUTIONS).issues).toEqual([]);
  });

  it('labels each as in development and does not replace the capability pages', () => {
    for (const slug of WAVE2) {
      const entry = getSolution(slug);
      expect(entry.status, slug).toBe('in development');
      expect(entry.platforms.find((p) => p.platform === 'web')?.status, slug).toBe(
        'in development'
      );
      expect(entry.replaces, slug).toBeUndefined();
      expect(entry.route).toBe(`/solutions/${slug}/`);
      expect(entry.docs).toBe(`/guides/solutions/${slug}/`);
      expect(entry.limits.length, slug).toBeGreaterThan(0);
      expect(entry.demo.id).toBe(slug);
    }
  });

  it('appears in the catalog, index.json and nav when the landing exists', () => {
    expect(catalogCards().map((card) => card.slug)).toEqual(SOLUTIONS.map((entry) => entry.slug));
    const index = solutionsIndexDocument('https://texuli.com');
    expect(index.solutions.map((row) => row.slug)).toEqual(
      SOLUTIONS.filter((entry) => siteRouteExists(entry.route)).map((entry) => entry.slug)
    );
    const nav = solutionNavLinks();
    for (const slug of WAVE2) {
      const href = `/solutions/${slug}/`;
      expect(nav.some((link) => link.href === href)).toBe(siteRouteExists(href));
    }
  });
});
