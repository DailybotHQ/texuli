/**
 * `emoji.search`, `emoji.get`, `emoji.categories` and `emoji.variants`:
 * closed catalog lookup through `@texuli/emojis/catalog` (ADR-035). Node
 * only — the remote MCP Function never imports this module.
 */

import {
  emojiCatalog,
  getBaseEmoji,
  getEmoji,
  getVariants,
  searchEmojis,
} from '@texuli/emojis/catalog';
import {
  CATEGORY_VALUES,
  type CatalogRecord,
  type EmojiCategory,
  isCategory,
  publicEmoji,
  publicEmojiSchema,
  QUERY_MAX,
  READ_ONLY,
  SEARCH_DEFAULT,
  SEARCH_MAX,
} from './emoji.ts';
import { defineOperation } from './registry.ts';
import { type Operation, OperationError } from './types.ts';

export const emojiSearch: Operation = defineOperation({
  name: 'emoji.search',
  title: 'Search the Texuli emoji catalog',
  summary:
    'Search the closed Unicode emoji catalog by name, shortcode or keyword. Returns { items }: approved ids with unicode, name, shortcode, category and score. Query at most 256 characters; at most 100 hits. Untrusted input; never throws. Needs Node (local MCP and CLI; not on texuli.com/mcp).',
  input: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: QUERY_MAX,
        description: 'Name, shortcode or keyword (at most 256 characters).',
      },
      locale: {
        type: 'string',
        maxLength: 32,
        description: 'BCP 47 locale for matching (default en).',
      },
      category: {
        type: 'string',
        enum: CATEGORY_VALUES,
        description: 'Keep only this Unicode category.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: SEARCH_MAX,
        default: SEARCH_DEFAULT,
        description: `How many hits to return (1 to ${SEARCH_MAX}, default ${SEARCH_DEFAULT}).`,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        maxItems: SEARCH_MAX,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            unicode: { type: 'string' },
            name: { type: 'string' },
            shortcode: { type: 'string' },
            category: { type: 'string', enum: CATEGORY_VALUES },
            score: { type: 'number' },
          },
          required: ['id', 'unicode', 'name', 'shortcode', 'category', 'score'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  runtime: 'node',
  limits: { inputBytes: 8_192, items: SEARCH_MAX, timeMs: 5_000 },
  examples: [
    { title: 'Find a rocket', input: { query: 'rocket', limit: 3 } },
    { title: 'Travel category', input: { query: 'launch', category: 'travel-places', limit: 5 } },
  ],
  handler(input) {
    try {
      const query = typeof input.query === 'string' ? input.query : '';
      const locale = typeof input.locale === 'string' ? input.locale : undefined;
      const category = isCategory(input.category) ? input.category : undefined;
      const limit =
        typeof input.limit === 'number' && Number.isFinite(input.limit)
          ? input.limit
          : SEARCH_DEFAULT;
      const hits = searchEmojis(query, { locale, category, limit });
      return {
        items: hits.map((hit) => ({
          id: hit.emoji.id,
          unicode: hit.emoji.unicode,
          name: hit.emoji.name,
          shortcode: hit.emoji.shortcode,
          category: hit.emoji.category,
          score: hit.score,
        })),
      };
    } catch {
      return { items: [] };
    }
  },
});

export const emojiGet: Operation = defineOperation({
  name: 'emoji.get',
  title: 'Read one emoji by id',
  summary:
    'Look up one closed catalog record by hyphenated id, Unicode sequence or :shortcode:. Returns { emoji } with unicode, name, shortcode, category and variant fields. Unknown ids are not-found. Untrusted input; never throws. Needs Node (local MCP and CLI; not on texuli.com/mcp).',
  input: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        maxLength: QUERY_MAX,
        description: 'Hyphenated hex id, Unicode sequence, or :shortcode:.',
      },
    },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: { emoji: publicEmojiSchema },
    required: ['emoji'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  runtime: 'node',
  limits: { inputBytes: 2_048, timeMs: 5_000 },
  examples: [
    { title: 'Rocket by id', input: { id: '1f680' } },
    { title: 'Rocket by shortcode', input: { id: ':rocket:' } },
  ],
  handler(input) {
    const id = typeof input.id === 'string' ? input.id : '';
    let record: CatalogRecord | undefined;
    try {
      record = getEmoji(id);
    } catch {
      record = undefined;
    }
    if (!record)
      throw new OperationError(
        'not-found',
        `Unknown emoji "${id.slice(0, QUERY_MAX)}". Search with emoji.search first.`
      );
    return { emoji: publicEmoji(record) };
  },
});

export const emojiCategories: Operation = defineOperation({
  name: 'emoji.categories',
  title: 'List emoji categories',
  summary:
    'List the closed Unicode emoji categories with how many catalog records each holds. Returns { categories: [{ id, count }] }. No input. Never throws. Needs Node (local MCP and CLI; not on texuli.com/mcp).',
  input: { type: 'object', properties: {}, additionalProperties: false },
  output: {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        maxItems: CATEGORY_VALUES.length,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: CATEGORY_VALUES },
            count: { type: 'integer', minimum: 0 },
          },
          required: ['id', 'count'],
          additionalProperties: false,
        },
      },
    },
    required: ['categories'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  runtime: 'node',
  limits: { inputBytes: 1_024, items: CATEGORY_VALUES.length, timeMs: 5_000 },
  examples: [{ title: 'Every category', input: {} }],
  handler() {
    try {
      const counts = new Map<EmojiCategory, number>();
      for (const id of CATEGORY_VALUES) counts.set(id, 0);
      for (const record of emojiCatalog.records) {
        const category = isCategory(record.category) ? record.category : undefined;
        if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
      }
      return {
        categories: CATEGORY_VALUES.map((id) => ({ id, count: counts.get(id) ?? 0 })),
      };
    } catch {
      return { categories: CATEGORY_VALUES.map((id) => ({ id, count: 0 })) };
    }
  },
});

export const emojiVariants: Operation = defineOperation({
  name: 'emoji.variants',
  title: 'List emoji variants',
  summary:
    'List tone and other variants for a closed catalog id (or a variant of it). Returns { base, variants }. Unknown ids are not-found. Untrusted input; never throws. Needs Node (local MCP and CLI; not on texuli.com/mcp).',
  input: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        maxLength: QUERY_MAX,
        description: 'Hyphenated hex id, Unicode sequence, or :shortcode:.',
      },
    },
    required: ['id'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      base: publicEmojiSchema,
      variants: {
        type: 'array',
        maxItems: SEARCH_MAX,
        items: publicEmojiSchema,
      },
    },
    required: ['variants'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  runtime: 'node',
  limits: { inputBytes: 2_048, items: SEARCH_MAX, timeMs: 5_000 },
  examples: [{ title: 'Thumbs-up tones', input: { id: '1f44d' } }],
  handler(input) {
    const id = typeof input.id === 'string' ? input.id : '';
    let record: CatalogRecord | undefined;
    let base: CatalogRecord | undefined;
    let variants: readonly CatalogRecord[] = [];
    try {
      record = getEmoji(id);
      base = record ? (getBaseEmoji(record.id) ?? record) : undefined;
      variants = record ? getVariants(record.id) : [];
    } catch {
      record = undefined;
    }
    if (!record)
      throw new OperationError(
        'not-found',
        `Unknown emoji "${id.slice(0, QUERY_MAX)}". Search with emoji.search first.`
      );
    return {
      ...(base ? { base: publicEmoji(base) } : {}),
      variants: variants.slice(0, SEARCH_MAX).map(publicEmoji),
    };
  },
});
