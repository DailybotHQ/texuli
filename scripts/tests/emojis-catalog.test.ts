import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EmojiAliasIndex, EmojiCatalog } from '../../packages/emojis/src/data/schema.ts';
import { generateFiles, outputPath } from '../emojis/generate-catalog.ts';

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

  it('does not fall back to hyphenated code-point shortcodes after keycap naming', () => {
    const hexFallback = catalog.records.filter((record) =>
      record.shortcode.slice(1, -1).endsWith(`_${record.id.replaceAll('-', '_')}`)
    );
    expect(hexFallback).toEqual([]);
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

  it('carries the 3.0.2 slug per mapped record for the legacy writer', () => {
    expect(aliases.slugs['1f680']).toBe('rocket');
    expect(aliases.slugs['2764-fe0f']).toBe('red_heart');
    expect(aliases.slugs['1f60e']).toBe('smiling_face_with_sunglasses');
    expect(aliases.slugs['2615']).toBe('hot_beverage');
    expect(aliases.slugs['31-fe0f-20e3']).toBe('keycap_1');
    expect(aliases.slugs['23-fe0f-20e3']).toBe('keycap_number_sign');
    expect(aliases.dialects.legacy.thumbsup).toBe('1f44d');
    expect(aliases.dialects.legacy['+1']).toBe('1f44d');
    expect(aliases.dialects.legacy.heart).toBe('2764-fe0f');
    expect(aliases.dialects.legacy.coffee).toBe('2615');
    expect(aliases.dialects.legacy['100']).toBe('1f4af');
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
      expect(readFileSync(outputPath(name), 'utf8'), name).toBe(expected);
    }
  });
});
