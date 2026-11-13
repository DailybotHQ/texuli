import { emojiCatalog } from './data/catalog.ts';
import type { EmojiCategory, EmojiRecord } from './data/schema.ts';

export type { EmojiCategory, EmojiRecord };
export { emojiCatalog };

export interface EmojiSearchOptions {
  readonly locale?: string;
  readonly category?: EmojiCategory;
  readonly limit?: number;
  readonly includeVariants?: boolean;
}
export interface EmojiSearchResult {
  readonly emoji: EmojiRecord;
  readonly score: number;
}

export function getEmoji(query: unknown): EmojiRecord | undefined {
  if (typeof query !== 'string' || query.length > 256) return undefined;
  const value = query.trim();
  return emojiCatalog.records.find(
    (record) => record.id === value || record.unicode === value || record.shortcode === value
  );
}

export function listEmojis(
  options: { category?: EmojiCategory; includeVariants?: boolean } = {}
): readonly EmojiRecord[] {
  return emojiCatalog.records.filter(
    (record) =>
      (!options.category || record.category === options.category) &&
      (options.includeVariants !== false || !record.variantOf)
  );
}

export function searchEmojis(
  query: unknown,
  options: EmojiSearchOptions = {}
): readonly EmojiSearchResult[] {
  if (typeof query !== 'string' || query.length > 256) return [];
  const needle = query.trim().toLocaleLowerCase(options.locale ?? 'en');
  if (!needle) return [];
  const limit = Number.isFinite(options.limit)
    ? Math.max(0, Math.min(100, Math.floor(options.limit ?? 20)))
    : 20;
  if (limit === 0) return [];
  const scored: EmojiSearchResult[] = [];
  for (const emoji of emojiCatalog.records) {
    if (options.category && emoji.category !== options.category) continue;
    if (!options.includeVariants && emoji.variantOf) continue;
    const fields = [emoji.name, emoji.shortcode, ...emoji.aliases, ...emoji.keywords];
    let score = 0;
    for (const field of fields) {
      const normalized = field.toLocaleLowerCase(options.locale ?? 'en');
      if (normalized === needle) score = Math.max(score, 100);
      else if (normalized.startsWith(needle)) score = Math.max(score, 50);
      else if (normalized.includes(needle)) score = Math.max(score, 10);
    }
    if (score) scored.push({ emoji, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.emoji.sortOrder - b.emoji.sortOrder ||
      (a.emoji.id < b.emoji.id ? -1 : 1)
  );
  return scored.slice(0, limit);
}

export function getVariants(id: unknown): readonly EmojiRecord[] {
  const base = getEmoji(id);
  if (!base) return [];
  const target = base.variantOf ?? base.id;
  const parent = emojiCatalog.records.find((item) => item.id === target);
  return (parent?.variants ?? []).flatMap((variantId) => {
    const variant = emojiCatalog.records.find((item) => item.id === variantId);
    return variant ? [variant] : [];
  });
}

export function getBaseEmoji(id: unknown): EmojiRecord | undefined {
  const emoji = getEmoji(id);
  if (!emoji?.variantOf) return emoji;
  return emojiCatalog.records.find((item) => item.id === emoji.variantOf);
}

export function getToneVariants(id: unknown): readonly EmojiRecord[] {
  return getVariants(id).filter((emoji) => emoji.tone !== undefined);
}
