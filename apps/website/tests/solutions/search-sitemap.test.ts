import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { SEARCH_INDEX } from '../../src/components/search/index-data.ts';
import { SEO_EXCLUDED } from '../../src/components/seo/seo.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';

const pathOf = (href: string) => href.split(/[?#]/)[0] ?? '';
const replaced = SOLUTIONS.map((entry) => entry.replaces ?? '').filter(Boolean);

describe('search and sitemap follow the new canonicals (ADR-028)', () => {
  it('the search index never points at a redirected *-page route', () => {
    const hits = SEARCH_INDEX.filter((entry) => replaced.includes(pathOf(entry.href)));
    expect(hits.map((entry) => entry.id)).toEqual([]);
  });

  it('every Solution landing, the catalog and Built with Texuli are searchable', () => {
    const hrefs = new Set(SEARCH_INDEX.map((entry) => pathOf(entry.href)));
    for (const route of [
      '/solutions/',
      ...SOLUTIONS.map((entry) => entry.route),
      '/built-with/',
      '/built-with/protoyard/',
      '/native/compatibility/',
    ]) {
      expect(hrefs.has(route), route).toBe(true);
    }
  });

  it('every search page entry names a route that exists', () => {
    const pages = SEARCH_INDEX.filter(
      (entry) => entry.kind === 'page' && entry.href.startsWith('/')
    );
    const missing = pages
      .map((entry) => pathOf(entry.href))
      .filter((path) => !siteRouteExists(path));
    expect(missing).toEqual([]);
  });

  it('the sitemap leaves out every redirected route', () => {
    for (const route of replaced) expect(SEO_EXCLUDED.has(route), route).toBe(true);
    expect(SEO_EXCLUDED.has('/workflows-page/json/')).toBe(false);
  });
});
