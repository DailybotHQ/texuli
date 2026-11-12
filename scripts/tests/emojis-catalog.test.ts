import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EmojiAliasIndex, EmojiCatalog } from '../../packages/emojis/src/data/schema.ts';
import { generateFiles } from '../emojis/generate-catalog.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const DATA = resolve(ROOT, 'packages/emojis/src/data');
const catalog = JSON.parse(readFileSync(resolve(DATA, 'catalog.json'), 'utf8')) as EmojiCatalog;
const aliases = JSON.parse(readFileSync(resolve(DATA, 'aliases.json'), 'utf8')) as EmojiAliasIndex;
const golden = JSON.parse(
  readFileSync(resolve(ROOT, 'scripts/tests/fixtures/emoji-catalog-golden.json'), 'utf8')
) as {
  records: { unicode: string; id: string; shortcode: string; variantOf?: string; tone?: string }[];
  qualificationAliases: { unicode: string; id: string }[];
  legacyAliases: Record<string, string>;
  legacyConflicts: string[];
};

describe('Emoji 18.0 generated catalog', () => {
  it('matches the checked-in source-derived count and version contract', () => {
    expect(catalog.schemaVersion).toBe('texuli-emoji/v1');
    expect(catalog.unicodeEmojiVersion).toBe('18.0');
    expect(catalog.cldrVersion).toBe('49');
    expect(catalog.records).toHaveLength(3963);
    expect(catalog.records.map((record) => record.sortOrder)).toEqual(
      Array.from({ length: catalog.records.length }, (_, index) => index)
    );
  });

  it('keeps codepoint ids, Unicode values and canonical shortcodes unique', () => {
    expect(new Set(catalog.records.map((record) => record.id)).size).toBe(catalog.records.length);
    expect(new Set(catalog.records.map((record) => record.unicode)).size).toBe(
      catalog.records.length
    );
    expect(new Set(catalog.records.map((record) => record.shortcode)).size).toBe(
      catalog.records.length
    );
    for (const record of catalog.records) {
      expect(record.id).toBe(
        record.codepoints.map((point) => Number.parseInt(point, 16).toString(16)).join('-')
      );
      expect(record.artAvailable).toBe(false);
    }
  });

  it('matches Unicode, qualification, tone, flag, ZWJ and keycap goldens', () => {
    for (const expected of golden.records) {
      const record = catalog.records.find((item) => item.unicode === expected.unicode);
      expect(record).toMatchObject(expected);
    }
    for (const expected of golden.qualificationAliases) {
      expect(
        catalog.records.find((record) => record.id === expected.id)?.qualificationAliases
      ).toContain(expected.unicode);
    }
  });

  it('imports all audited legacy rows and separates alias conflicts', () => {
    expect(aliases.migration).toMatchObject({
      sourceRows: 1914,
      mappedRows: 1914,
      unmappedUnicode: [],
    });
    for (const [alias, id] of Object.entries(golden.legacyAliases)) {
      expect(aliases.dialects.legacy[alias]).toBe(id);
    }
    expect(aliases.conflicts.map((conflict) => conflict.alias).sort()).toEqual(
      golden.legacyConflicts
    );
    for (const conflict of aliases.conflicts) {
      expect(aliases.dialects.legacy).not.toHaveProperty(conflict.alias);
      expect(conflict.candidates).toContain(conflict.permissiveId);
      expect(new Set(conflict.candidates).size).toBe(conflict.candidates.length);
    }
  });

  it('produces byte-stable outputs from the SHA-256-locked local inputs', () => {
    const generated = generateFiles();
    for (const [name, expected] of Object.entries(generated)) {
      expect(readFileSync(resolve(DATA, name), 'utf8')).toBe(expected);
    }
  });
});
