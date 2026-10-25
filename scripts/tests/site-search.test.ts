// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SEARCH_INDEX } from '../../apps/website/src/components/search/index-data.ts';
import {
  defaultRecentEntries,
  scoreEntry,
  searchSiteIndex,
} from '../../apps/website/src/components/search/search.ts';
import type { SearchEntry } from '../../apps/website/src/components/search/types.ts';

const fixture: SearchEntry[] = [
  {
    id: 'page-home',
    title: 'Home',
    description: 'Landing',
    href: '/',
    kind: 'page',
    keywords: ['texuli'],
  },
  {
    id: 'component-button',
    title: 'Button',
    description: 'Actions',
    href: '/search/?q=Button',
    kind: 'component',
    keywords: ['button', 'ui'],
  },
  {
    id: 'theme-ocean',
    title: 'Ocean',
    description: 'Blue calm theme',
    href: '/search/?q=ocean',
    kind: 'theme',
    keywords: ['blue', 'water'],
  },
];

describe('site search index', () => {
  it('includes pages, docs, components, themes and examples', () => {
    const kinds = new Set(SEARCH_INDEX.map((e) => e.kind));
    expect(kinds.has('page')).toBe(true);
    expect(kinds.has('docs')).toBe(true);
    expect(kinds.has('component')).toBe(true);
    expect(kinds.has('theme')).toBe(true);
    expect(kinds.has('example')).toBe(true);
    expect(SEARCH_INDEX.length).toBeGreaterThan(50);
  });

  it('ranks exact title matches ahead of keyword hits', () => {
    const hits = searchSiteIndex('button', { index: fixture });
    expect(hits[0]?.id).toBe('component-button');
  });

  it('requires every token to match', () => {
    expect(searchSiteIndex('button missing', { index: fixture })).toEqual([]);
    expect(scoreEntry(fixture[1]!, ['button'])).not.toBeNull();
    expect(scoreEntry(fixture[1]!, ['button', 'zzz'])).toBeNull();
  });

  it('filters by kind and respects limit', () => {
    const themes = searchSiteIndex('ocean', { index: fixture, kinds: ['theme'] });
    expect(themes).toHaveLength(1);
    expect(themes[0]?.kind).toBe('theme');
    expect(searchSiteIndex('', { index: fixture, limit: 2 })).toHaveLength(2);
  });

  it('builds recent suggestions from preferred ids', () => {
    const recent = defaultRecentEntries(fixture);
    expect(recent.some((e) => e.id === 'page-home')).toBe(true);
    expect(recent.length).toBeGreaterThan(0);
  });
});
