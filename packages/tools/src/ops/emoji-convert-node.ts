/**
 * Local `emoji.convert`: canonical Texuli conversion plus the imported 3.0.2
 * legacy dialect. Node only — `@texuli/emojis/legacy-engine` never enters
 * the remote MCP Function graph. The edge registry serves a lean convert
 * instead (`emoji.ts`).
 */

import { toShortcodes, toUnicode } from '@texuli/emojis';
import { toShortcodes as toLegacyShortcodes, toUnicodeLegacy } from '@texuli/emojis/legacy-engine';
import {
  DIAGNOSTIC_MAX,
  diagnosticsSchema,
  EMOJI_DIALECTS,
  EMOJI_MODES,
  EMOJI_TARGETS,
  type EmojiDialect,
  type EmojiMode,
  type EmojiTarget,
  INPUT_BYTES,
  isDialect,
  isMode,
  isTarget,
  publicDiagnostics,
  READ_ONLY,
  SOURCE_MAX,
} from './emoji.ts';
import { defineOperation } from './registry.ts';
import type { Operation } from './types.ts';

function convertSource(
  source: string,
  to: EmojiTarget,
  dialect: EmojiDialect,
  mode: EmojiMode
): { value: string; diagnostics: { code: string; message: string }[] } {
  if (dialect === 'legacy') {
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
  if (to === 'unicode') return { value: toUnicode(source), diagnostics: [] };
  return { value: toShortcodes(source), diagnostics: [] };
}

export const emojiConvertLocal: Operation = defineOperation({
  name: 'emoji.convert',
  title: 'Convert shortcodes and Unicode emoji',
  summary:
    'Convert untrusted plain text between Unicode sequences and shortcodes. dialect texuli is the lean catalog; legacy is the imported 3.0.2 aliases (local MCP and CLI). mode strict keeps conflict aliases and reports them; permissive picks a candidate. Returns { value, diagnostics }. Never throws.',
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
  runtime: 'node',
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
  handler(input) {
    const source = typeof input.source === 'string' ? input.source : '';
    const to = isTarget(input.to) ? input.to : 'unicode';
    const dialect = isDialect(input.dialect) ? input.dialect : 'texuli';
    const mode = isMode(input.mode) ? input.mode : 'strict';
    try {
      return convertSource(source, to, dialect, mode);
    } catch {
      return {
        value: source,
        diagnostics: [{ code: 'convert-failed', message: 'Conversion refused.' }],
      };
    }
  },
});
