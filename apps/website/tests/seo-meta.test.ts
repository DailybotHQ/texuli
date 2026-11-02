/**
 * PLAN_014 SEO and content helpers: in-band meta descriptions, the
 * site-wide JSON-LD graph, and the navigation note for the navigation ids
 * the catalog files under `overlays`.
 */
import { describe, expect, it } from 'vitest';
import {
  FAMILY_NOTES,
  familyNote,
  NAVIGATION_IDS,
  NAVIGATION_NOTE,
} from '../src/components/component-pages/family-notes.ts';
import { META_DESCRIPTION_MAX, metaDescription } from '../src/components/seo/seo.ts';
import { siteJsonLd } from '../src/lib/schema.ts';

describe('metaDescription', () => {
  it('keeps whole sentences, adding the context sentence while both fit', () => {
    expect(metaDescription('A responsive grid of cards.', 'A copy-paste section template.')).toBe(
      'A responsive grid of cards. A copy-paste section template.'
    );
    const long = `${'Word '.repeat(25).trim()}. Second sentence that would not fit.`;
    const out = metaDescription(long);
    expect(out).toBe(`${'Word '.repeat(25).trim()}.`);
    expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
  });

  it('cuts one overlong sentence at a word boundary with an ellipsis', () => {
    const out = metaDescription(`${'lengthy '.repeat(40).trim()}.`);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(out).not.toMatch(/\s…$/);
  });

  it('collapses whitespace and never returns an empty string for real copy', () => {
    expect(metaDescription('  Two\n  lines.  ', '')).toBe('Two lines.');
  });
});

describe('siteJsonLd', () => {
  const url = 'https://texuli.com/guides/theming/';

  it('carries the organization, the website with search, and the page', () => {
    const graph = siteJsonLd(url, 'Theming · Texuli', 'Themes and tokens.')['@graph'];
    expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite', 'WebPage']);
    expect(graph[2]).toMatchObject({
      url,
      name: 'Theming · Texuli',
      isPartOf: { '@id': 'https://texuli.com/#website' },
    });
    expect(JSON.stringify(graph[1])).toContain('/search/?q={search_term_string}');
  });

  it('merges a page graph and drops its duplicate Organization and WebSite nodes', () => {
    const page = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Dailybot, Inc.' },
        { '@type': 'WebSite', name: 'Texuli' },
        { '@type': 'WebAPI', name: 'Texuli public API' },
      ],
    };
    const types = siteJsonLd(url, 'Developers', 'API.', page)['@graph'].map(
      (node) => node['@type']
    );
    expect(types).toEqual(['Organization', 'WebSite', 'WebPage', 'WebAPI']);
  });
});

describe('familyNote', () => {
  it('gives navigation ids filed under overlays the navigation note', () => {
    for (const id of NAVIGATION_IDS) expect(familyNote('overlays', id)).toBe(NAVIGATION_NOTE);
    expect(familyNote('overlays', 'dialog')).toBe(FAMILY_NOTES.overlays);
    expect(familyNote('overlays')).toBe(FAMILY_NOTES.overlays);
  });
});
