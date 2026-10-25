/**
 * Unit tests for the texuli.com component gallery catalog and filters.
 */
import { describe, expect, it } from 'vitest';
import {
  buildGalleryComponentCards,
  filterGalleryComponents,
  galleryAllTags,
  galleryCategories,
} from '../../apps/website/src/components/gallery-components/index.ts';

describe('site gallery components', () => {
  const cards = buildGalleryComponentCards();

  it('builds a non-empty closed catalog sorted by id', () => {
    expect(cards.length).toBeGreaterThan(20);
    const ids = cards.map((c) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b, 'en')));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes categories and tags for every card', () => {
    const categories = galleryCategories(cards);
    expect(categories).toEqual(
      expect.arrayContaining(['content', 'display', 'forms', 'layouts', 'overlays'])
    );
    const tags = galleryAllTags(cards);
    expect(tags.length).toBeGreaterThan(10);
    for (const card of cards) {
      expect(card.category).toBeTruthy();
      expect(card.href).toBe(`/component-pages/${card.id}/`);
      expect(card.tags).toContain(card.category);
      expect(card.tags).toContain(card.tier);
    }
  });

  it('filters by category, tag and free-text query', () => {
    const display = filterGalleryComponents(cards, { category: 'display' });
    expect(display.length).toBeGreaterThan(0);
    expect(display.every((c) => c.category === 'display')).toBe(true);

    const badge = filterGalleryComponents(cards, { query: 'badge' });
    expect(badge.some((c) => c.id === 'badge')).toBe(true);

    const agent = filterGalleryComponents(cards, { tag: 'agent-emittable' });
    expect(agent.every((c) => c.agentEmittable)).toBe(true);

    const none = filterGalleryComponents(cards, {
      category: 'display',
      query: 'this-will-not-match-zzzz',
    });
    expect(none).toEqual([]);
  });

  it('lists variants from enum props and examples on badge', () => {
    const badge = cards.find((c) => c.id === 'badge');
    expect(badge).toBeDefined();
    expect(badge!.variants.length).toBeGreaterThan(0);
    expect(badge!.variants).toEqual(expect.arrayContaining(['success']));
    expect(badge!.examples.length).toBeGreaterThan(0);
  });
});
