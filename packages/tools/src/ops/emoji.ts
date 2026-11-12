/**
 * `emoji.convert` (edge): untrusted conversion through the lean
 * `@texuli/emojis` engine (ADR-035). Canonical Texuli shortcodes and Unicode
 * only. dialect "legacy" returns a diagnostic pointing at the local MCP;
 * the local registry replaces this operation with a node convert that loads
 * the imported 3.0.2 aliases. Catalog lookup lives in `emoji-catalog.ts`.
 */

import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import type { Operation } from './types.ts';

export const QUERY_MAX = 256;
export const SOURCE_MAX = 100_000;
export const INPUT_BYTES = SOURCE_MAX + 100_000;
export const SEARCH_DEFAULT = 20;
export const SEARCH_MAX = 100;
export const DIAGNOSTIC_MAX = 200;
export const CATEGORY_VALUES = [
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

export type EmojiCategory = (typeof CATEGORY_VALUES)[number];
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

export const diagnosticsSchema: JsonSchema = {
  type: 'array',
  maxItems: DIAGNOSTIC_MAX,
  items: diagnosticItem,
  description: 'Conflict aliases, unknown aliases, or a refused conversion.',
};

export const publicEmojiSchema: JsonSchema = {
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

export const READ_ONLY = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

export interface CatalogRecord {
  id: string;
  unicode: string;
  name: string;
  shortcode: string;
  category: string;
  variantOf?: string;
  variants?: readonly string[];
  tone?: string;
}

export function isCategory(value: unknown): value is EmojiCategory {
  return typeof value === 'string' && (CATEGORY_VALUES as readonly string[]).includes(value);
}

export function isDialect(value: unknown): value is EmojiDialect {
  return typeof value === 'string' && (EMOJI_DIALECTS as readonly string[]).includes(value);
}

export function isMode(value: unknown): value is EmojiMode {
  return typeof value === 'string' && (EMOJI_MODES as readonly string[]).includes(value);
}

export function isTarget(value: unknown): value is EmojiTarget {
  return typeof value === 'string' && (EMOJI_TARGETS as readonly string[]).includes(value);
}

export function publicEmoji(record: CatalogRecord): Record<string, unknown> {
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

export function publicDiagnostics(
  list: readonly { code: string; message: string }[]
): { code: string; message: string }[] {
  return list.slice(0, DIAGNOSTIC_MAX).map((item) => ({ code: item.code, message: item.message }));
}

export const LEGACY_LOCAL_ONLY = {
  code: 'legacy-local-only',
  message:
    'dialect "legacy" needs the local MCP (npx -y @texuli/mcp) or `texuli emoji convert`. The remote endpoint converts canonical Texuli shortcodes only.',
} as const;

async function convertLean(
  source: string,
  to: EmojiTarget
): Promise<{ value: string; diagnostics: { code: string; message: string }[] }> {
  const { toShortcodes, toUnicode } = await import('@texuli/emojis');
  if (to === 'unicode') return { value: toUnicode(source), diagnostics: [] };
  return { value: toShortcodes(source), diagnostics: [] };
}

export const emojiConvert: Operation = defineOperation({
  name: 'emoji.convert',
  title: 'Convert shortcodes and Unicode emoji',
  summary:
    'Convert untrusted plain text between Unicode sequences and canonical Texuli shortcodes through the lean engine. dialect texuli is the default. dialect legacy is unsupported here and returns a diagnostic pointing at the local MCP. Returns { value, diagnostics }. Never throws.',
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
        description:
          'texuli (canonical, default). legacy is the imported 3.0.2 aliases and needs the local MCP.',
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
  ],
  async handler(input) {
    const source = typeof input.source === 'string' ? input.source : '';
    const to = isTarget(input.to) ? input.to : 'unicode';
    const dialect = isDialect(input.dialect) ? input.dialect : 'texuli';
    try {
      if (dialect === 'legacy') {
        return { value: source, diagnostics: publicDiagnostics([LEGACY_LOCAL_ONLY]) };
      }
      return await convertLean(source, to);
    } catch {
      return {
        value: source,
        diagnostics: [{ code: 'convert-failed', message: 'Conversion refused.' }],
      };
    }
  },
});
