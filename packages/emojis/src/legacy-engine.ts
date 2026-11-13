import { emojiCatalog } from './data/catalog.ts';
import { emojiAliases } from './data/legacy.ts';
import type { EmojiParseMode } from './index.ts';
import {
  findEmojis,
  toShortcodes as toTexuliShortcodes,
  toUnicode as toTexuliUnicode,
} from './index.ts';

const recordById = new Map(emojiCatalog.records.map((record) => [record.id, record]));

export interface LegacyConversionResult {
  readonly text: string;
  readonly conflicts: readonly { alias: string; candidates: readonly string[] }[];
  readonly unknown: readonly string[];
}

export interface DialectConversionOptions {
  readonly dialect?: 'texuli' | 'legacy';
  readonly mode?: EmojiParseMode;
}

/** Convert shortcodes for either the lean Texuli dialect or imported legacy aliases. */
export function toUnicode(text: unknown, options: DialectConversionOptions = {}): string {
  if (options.dialect !== 'legacy') return toTexuliUnicode(typeof text === 'string' ? text : '');
  return toUnicodeLegacy(text, options).text;
}

/** Convert Unicode sequences using the selected dialect's preferred shortcode. */
export function toShortcodes(text: unknown, options: DialectConversionOptions = {}): string {
  if (options.dialect !== 'legacy') return toTexuliShortcodes(typeof text === 'string' ? text : '');
  return toShortcodesLegacy(text);
}

/** Convert legacy aliases without making compatibility data part of the lean default entry. */
export function toUnicodeLegacy(
  text: unknown,
  options: { mode?: EmojiParseMode } = {}
): LegacyConversionResult {
  if (typeof text !== 'string') return { text: '', conflicts: [], unknown: [] };
  const conflicts: { alias: string; candidates: readonly string[] }[] = [];
  const unknown: string[] = [];
  const output = text.replace(/:([a-z0-9_+-]{1,80}):/g, (source, alias: string) => {
    const conflict = emojiAliases.conflicts.find((entry) => entry.alias === alias);
    if (conflict) {
      if ((options.mode ?? 'strict') === 'strict') {
        conflicts.push({ alias, candidates: conflict.candidates });
        return source;
      }
      return recordById.get(conflict.permissiveId)?.unicode ?? source;
    }
    const id = emojiAliases.dialects.legacy[alias];
    if (!id) {
      unknown.push(alias);
      return source;
    }
    return recordById.get(id)?.unicode ?? source;
  });
  return { text: output, conflicts, unknown };
}

/** Return the 3.0.2 slug (`:rocket:`), not a keyword (`:launch:`). */
export function toShortcodesLegacy(text: unknown): string {
  if (typeof text !== 'string') return '';
  const matches = findEmojis(text, { source: 'unicode' });
  let output = '';
  let cursor = 0;
  for (const match of matches) {
    const record = recordById.get(match.id);
    const slug = (record && emojiAliases.slugs[record.id]) ?? record?.shortcode.slice(1, -1);
    output += text.slice(cursor, match.start);
    output += slug ? `:${slug}:` : match.source;
    cursor = match.end;
  }
  return output + text.slice(cursor);
}
