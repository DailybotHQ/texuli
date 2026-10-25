/**
 * Pure filter helpers for the component gallery (unit-tested, no DOM).
 */
import type { GalleryComponentCard } from './catalog.ts';

export type GalleryFilterInput = {
  query?: string;
  /** Category = manifest group; empty = all. */
  category?: string;
  /** Tag must be present on the card; empty = all. */
  tag?: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Filter gallery cards by free-text query, category and tag.
 * Query matches id, label, summary, package, tags and variants.
 */
export function filterGalleryComponents(
  cards: readonly GalleryComponentCard[],
  input: GalleryFilterInput = {}
): GalleryComponentCard[] {
  const q = normalize(input.query ?? '');
  const category = normalize(input.category ?? '');
  const tag = normalize(input.tag ?? '');

  return cards.filter((card) => {
    if (category && card.category !== category && normalize(card.category) !== category) {
      return false;
    }
    if (tag && !card.tags.some((t) => normalize(t) === tag)) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      card.id,
      card.label,
      card.summary,
      card.package,
      card.tier,
      card.category,
      ...card.tags,
      ...card.variants,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
