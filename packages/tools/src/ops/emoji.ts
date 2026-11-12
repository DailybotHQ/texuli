/**
 * `emoji.search`, `emoji.get`, `emoji.convert`, `emoji.categories` and
 * `emoji.variants`: untrusted lookup and conversion through `@texuli/emojis`
 * (ADR-035). Handlers never throw; input and result lists are capped.
 *
 * Catalog lookup (search, get, categories, variants) needs the closed
 * catalog tables and is `node` (local MCP and CLI). `emoji.convert` stays
 * `edge`; the lean engine and the imported 3.0.2 legacy dialect load on
 * demand so the remote MCP Function does not ship the catalog tables.
 */

import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import { type Operation, OperationError } from './types.ts';

const QUERY_MAX = 256;
const SOURCE_MAX = 100_000;
const INPUT_BYTES = SOURCE_MAX + 100_000;
const SEARCH_DEFAULT = 20;
const SEARCH_MAX = 100;
const DIAGNOSTIC_MAX = 200;
const CATEGORY_VALUES = [
  'smileys-emotion',
  'people-body',
  'animals-nature',
  'food-drink',
  'travel-places',
  'activities',
  'objects',
  'symbols',
  'flags',
] as const;

type EmojiCategory = (typeof CATEGORY_VALUES)[number];

export const EMOJI_DIALECTS = ['texuli', 'legacy'] as const;
export type EmojiDialect = (typeof EMOJI_DIALECTS)[number];
export const EMOJI_MODES = ['strict', 'permissive'] as const;
export type EmojiMode = (typeof EMOJI_MODES)[number];
export const EMOJI_TARGETS = ['unicode', 'shortcode'] as const;
export type EmojiTarget = (typeof EMOJI_TARGETS)[number];

const diagnosticItem: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', maxLength: 64, description: 'A stable diagnostic code.' },
    message: {
      type: 'string',
      maxLength: 2_000,
      description: 'What was kept, dropped or rewritten.',
    },
  },
  required: ['code', 'message'],
  additionalProperties: false,
};

const diagnosticsSchema: JsonSchema = {
  type: 'array',
  maxItems: DIAGNOSTIC_MAX,
  items: diagnosticItem,
  description: 'Conflict aliases, unknown aliases, or a refused conversion.',
};

const publicEmojiSchema: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Hyphenated hex codepoints (the closed catalog id).' },
    unicode: { type: 'string', description: 'The Unicode sequence.' },
    name: { type: 'string', description: 'CLDR English name.' },
    shortcode: { type: 'string', description: 'Canonical :shortcode:.' },
    category: { type: 'string', enum: CATEGORY_VALUES },
    variantOf: { type: 'string', description: 'Base id when this record is a variant.' },
    variants: {
      type: 'array',
      items: { type: 'string' },
      maxItems: SEARCH_MAX,
      description: 'Variant ids of a base record.',
    },
    tone: {
      type: 'string',
      enum: ['light', 'medium-light', 'medium', 'medium-dark', 'dark'],
    },
  },
  required: ['id', 'unicode', 'name', 'shortcode', 'category'],
  additionalProperties: false,
};

const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

interface CatalogRecord {
  id: string;
  unicode: string;
  name: string;
  shortcode: string;
  category: string;
  variantOf?: string;
  variants?: readonly string[];
  tone?: string;
}

function isCategory(value: unknown): value is EmojiCategory {
  return typeof value === 'string' && (CATEGORY_VALUES as readonly string[]).includes(value);
}

function isDialect(value: unknown): value is EmojiDialect {
  return typeof value === 'string' && (EMOJI_DIALECTS as readonly string[]).includes(value);
}

function isMode(value: unknown): value is EmojiMode {
  return typeof value === 'string' && (EMOJI_MODES as readonly string[]).includes(value);
}

function isTarget(value: unknown): value is EmojiTarget {
  return typeof value === 'string' && (EMOJI_TARGETS as readonly string[]).includes(value);
}

function publicEmoji(record: CatalogRecord): Record<string, unknown> {
  return {
    id: record.id,
    unicode: record.unicode,
    name: record.name,
    shortcode: record.shortcode,
    category: record.category,
    ...(record.variantOf ? { variantOf: record.variantOf } : {}),
    ...(record.variants && record.variants.length > 0
      ? { variants: record.variants.slice(0, SEARCH_MAX) }
      : {}),
    ...(record.tone ? { tone: record.tone } : {}),
  };
}

function publicDiagnostics(
  list: readonly { code: string; message: string }[]
): { code: string; message: string }[] {
  return list.slice(0, DIAGNOSTIC_MAX).map((item) => ({ code: item.code, message: item.message }));
}

async function loadCatalog() {
  return import('@texuli/emojis/catalog');
}

async function convertSource(
  source: string,
  to: EmojiTarget,
  dialect: EmojiDialect,
  mode: EmojiMode
): Promise<{ value: string; diagnostics: { code: string; message: string }[] }> {
  if (dialect === 'legacy') {
    const { toShortcodes: toLegacyShortcodes, toUnicodeLegacy } = await import(
      '@texuli/emojis/legacy-engine'
    );
    if (to === 'unicode') {
      const result = toUnicodeLegacy(source, { mode });
      const diagnostics: { code: string; message: string }[] = [];
      for (const conflict of result.conflicts) {
        diagnostics.push({
          code: 'conflict-alias',
          message: `:${conflict.alias}: is a conflict; candidates: ${conflict.candidates.join(', ')}.`,
        });
      }
      for (const alias of result.unknown) {
        diagnostics.push({
          code: 'unknown-alias',
          message: `:${alias}: is not in the legacy dialect.`,
        });
      }
      return { value: result.text, diagnostics: publicDiagnostics(diagnostics) };
    }
    return { value: toLegacyShortcodes(source, { dialect: 'legacy' }), diagnostics: [] };
  }
  const { toShortcodes, toUnicode } = await import('@texuli/emojis');
  if (to === 'unicode') return { value: toUnicode(source), diagnostics: [] };
  return { value: toShortcodes(source), diagnostics: [] };
}

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
  async handler(input) {
    try {
      const query = typeof input.query === 'string' ? input.query : '';
      const locale = typeof input.locale === 'string' ? input.locale : undefined;
      const category = isCategory(input.category) ? input.category : undefined;
      const limit =
        typeof input.limit === 'number' && Number.isFinite(input.limit)
          ? input.limit
          : SEARCH_DEFAULT;
      const { searchEmojis } = await loadCatalog();
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
  async handler(input) {
    const id = typeof input.id === 'string' ? input.id : '';
    let record: CatalogRecord | undefined;
    try {
      record = (await loadCatalog()).getEmoji(id);
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

export const emojiConvert: Operation = defineOperation({
  name: 'emoji.convert',
  title: 'Convert shortcodes and Unicode emoji',
  summary:
    'Convert untrusted plain text between Unicode sequences and shortcodes. dialect texuli is the lean catalog (edge); legacy is the imported 3.0.2 aliases (loaded on demand). mode strict keeps conflict aliases and reports them; permissive picks a candidate. Returns { value, diagnostics }. Never throws.',
  input: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        maxLength: SOURCE_MAX,
        description: 'Untrusted plain text (at most 100000 characters).',
      },
      to: {
        type: 'string',
        enum: EMOJI_TARGETS,
        description: 'unicode (shortcodes → sequences) or shortcode (sequences → :shortcode:).',
      },
      dialect: {
        type: 'string',
        enum: EMOJI_DIALECTS,
        default: 'texuli',
        description: 'texuli (canonical) or legacy (imported aliases). Default texuli.',
      },
      mode: {
        type: 'string',
        enum: EMOJI_MODES,
        default: 'strict',
        description: 'strict keeps conflict aliases; permissive resolves them. Default strict.',
      },
    },
    required: ['source', 'to'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      value: { type: 'string', description: 'The converted plain text.' },
      diagnostics: diagnosticsSchema,
    },
    required: ['value', 'diagnostics'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  runtime: 'edge',
  limits: { inputBytes: INPUT_BYTES, items: DIAGNOSTIC_MAX, timeMs: 10_000 },
  examples: [
    {
      title: 'Canonical shortcode to Unicode',
      input: { source: 'Ship it :rocket:!', to: 'unicode' },
    },
    {
      title: 'Legacy party alias',
      input: { source: ':tada:', to: 'unicode', dialect: 'legacy' },
    },
  ],
  async handler(input) {
    const source = typeof input.source === 'string' ? input.source : '';
    const to = isTarget(input.to) ? input.to : 'unicode';
    const dialect = isDialect(input.dialect) ? input.dialect : 'texuli';
    const mode = isMode(input.mode) ? input.mode : 'strict';
    try {
      return await convertSource(source, to, dialect, mode);
    } catch {
      return {
        value: source,
        diagnostics: [{ code: 'convert-failed', message: 'Conversion refused.' }],
      };
    }
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
  async handler() {
    try {
      const { emojiCatalog } = await loadCatalog();
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
  async handler(input) {
    const id = typeof input.id === 'string' ? input.id : '';
    let record: CatalogRecord | undefined;
    let base: CatalogRecord | undefined;
    let variants: readonly CatalogRecord[] = [];
    try {
      const catalog = await loadCatalog();
      record = catalog.getEmoji(id);
      base = record ? (catalog.getBaseEmoji(record.id) ?? record) : undefined;
      variants = record ? catalog.getVariants(record.id) : [];
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
