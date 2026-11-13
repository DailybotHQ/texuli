import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type EmojiCategory =
  | 'smileys-emotion'
  | 'people-body'
  | 'animals-nature'
  | 'food-drink'
  | 'travel-places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

export interface EmojiRecord {
  id: string;
  unicode: string;
  codepoints: string[];
  name: string;
  shortcode: `:${string}:`;
  aliases: string[];
  category: EmojiCategory;
  subcategory: string;
  sortOrder: number;
  emojiVersion: string;
  keywords: string[];
  qualificationAliases: string[];
  variantOf?: string;
  variants?: string[];
  tone?: 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';
  artAvailable: false;
}

export interface EmojiCatalog {
  schemaVersion: 'texuli-emoji/v1';
  unicodeEmojiVersion: '18.0';
  cldrVersion: '49';
  catalogVersion: '18.0.0+cldr.49';
  generatedAt: string;
  records: EmojiRecord[];
}

interface SourceLock {
  unicodeEmoji: string;
  unicodeRelease: string;
  cldr: string;
  capturedAt: string;
  files: { path: string; sha256: string }[];
  legacy: { path: string; sha256: string; version: string; license: string };
}

interface TestRow {
  cps: number[];
  unicode: string;
  status: string;
  group: string;
  subcategory: string;
  sortOrder: number;
  emojiVersion: string;
  sourceName: string;
}

interface LegacyRow {
  name: string;
  slug: string;
  char: string;
  keywords: string[];
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_DIR = resolve(ROOT, 'scripts/emojis/sources');
const DATA_DIR = resolve(ROOT, 'packages/emojis/src/data');
const KOTLIN_OUTPUT = resolve(
  ROOT,
  'packages/emojis/generated/kotlin/com/texuli/emojis/generated/EmojiCatalogData.kt'
);
const KOTLIN_DIR = dirname(KOTLIN_OUTPUT);
const CATEGORY: Record<string, EmojiCategory> = {
  'Smileys & Emotion': 'smileys-emotion',
  'People & Body': 'people-body',
  'Animals & Nature': 'animals-nature',
  'Food & Drink': 'food-drink',
  'Travel & Places': 'travel-places',
  Activities: 'activities',
  Objects: 'objects',
  Symbols: 'symbols',
  Flags: 'flags',
};
const TONES: Record<number, EmojiRecord['tone']> = {
  127995: 'light',
  127996: 'medium-light',
  127997: 'medium',
  127998: 'medium-dark',
  127999: 'dark',
};
function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function read(path: string): string {
  return readFileSync(resolve(SOURCE_DIR, path), 'utf8').replace(
    /\\u\{([\da-f]{1,6})\}/gi,
    (_escape, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16))
  );
}

function verifySources(lock: SourceLock): void {
  if (lock.unicodeEmoji !== '18.0' || lock.unicodeRelease !== '18.0.0' || lock.cldr !== '49') {
    throw new Error('source lock must pin Unicode Emoji 18.0.0 and CLDR 49');
  }
  for (const file of lock.files) {
    const actual = sha256(read(file.path));
    if (actual !== file.sha256) throw new Error(`SHA-256 mismatch for ${file.path}: ${actual}`);
  }
  const legacy = read(lock.legacy.path);
  const actualLegacy = sha256(legacy);
  if (actualLegacy !== lock.legacy.sha256) {
    throw new Error(`SHA-256 mismatch for ${lock.legacy.path}: ${actualLegacy}`);
  }
  if (lock.legacy.version !== '3.0.2' || lock.legacy.license !== 'MIT') {
    throw new Error('legacy alias source must remain the audited MIT 3.0.2 snapshot');
  }
}

function parseUnicode(codepoints: string): number[] {
  return codepoints
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseInt(part, 16));
}

function fromCodepoints(codepoints: readonly number[]): string {
  return String.fromCodePoint(...codepoints);
}

function kotlinString(value: string): string {
  // Escape every UTF-16 code unit. Generated Kotlin stays ASCII-only, including
  // for ZWJ and variation selectors in the Unicode sequences.
  return `"${Array.from({ length: value.length }, (_, index) => {
    const unit = value.charCodeAt(index);
    return unit >= 0x20 && unit <= 0x7e && unit !== 0x22 && unit !== 0x5c
      ? value[index]
      : `\\u${unit.toString(16).padStart(4, '0')}`;
  }).join('')}"`;
}

const KOTLIN_CHUNK_SIZE = 64;

function kotlinCatalog(records: readonly EmojiRecord[]): Record<string, string> {
  const chunks: string[] = [];
  const files: Record<string, string> = {};
  for (let start = 0; start < records.length; start += KOTLIN_CHUNK_SIZE) {
    const index = Math.floor(start / KOTLIN_CHUNK_SIZE);
    const chunkName = `EmojiCatalogChunk${String(index).padStart(2, '0')}`;
    const fileName = `kotlin/${chunkName}.kt`;
    const rows = records
      .slice(start, start + KOTLIN_CHUNK_SIZE)
      .map(
        (record) =>
          `    EmojiCatalogEntry(${kotlinString(record.id)}, ${kotlinString(record.unicode)}, ${kotlinString(record.shortcode)}, ${kotlinString(record.name)}, listOf(${[record.unicode, ...record.qualificationAliases].map(kotlinString).join(', ')})),`
      );
    chunks.push(`${chunkName}.entries`);
    files[fileName] = [
      '// Generated by scripts/emojis/generate-catalog.ts. Do not edit.',
      'package com.texuli.emojis.generated',
      '',
      `internal object ${chunkName} {`,
      '  val entries: List<EmojiCatalogEntry> = listOf(',
      ...rows,
      '  )',
      '}',
      '',
    ].join('\n');
  }
  files['kotlin/EmojiCatalogData.kt'] = [
    '// Generated by scripts/emojis/generate-catalog.ts. Do not edit.',
    'package com.texuli.emojis.generated',
    '',
    'data class EmojiCatalogEntry(val id: String, val unicode: String, val shortcode: String, val name: String, val sequences: List<String>)',
    '',
    'internal object EmojiCatalogData {',
    '  const val unicodeEmojiVersion = "18.0"',
    '  const val cldrVersion = "49"',
    '  val entries: List<EmojiCatalogEntry> by lazy {',
    `    listOf(${chunks.join(', ')}).flatten()`,
    '  }',
    '}',
    '',
  ].join('\n');
  return files;
}

function capture(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) throw new Error(`missing regex capture ${index}`);
  return value;
}

function codepointId(codepoints: readonly number[]): string {
  return codepoints.map((point) => point.toString(16)).join('-');
}

function qualificationKey(codepoints: readonly number[]): string {
  return codepoints.filter((point) => point !== 0xfe0f).join('-');
}

function categoryFromGroup(group: string): EmojiCategory {
  const category = CATEGORY[group];
  if (!category) throw new Error(`unsupported Unicode group: ${group}`);
  return category;
}

function parseEmojiTest(text: string): TestRow[] {
  let group = '';
  let subcategory = '';
  let sortOrder = 0;
  const rows: TestRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const groupMatch = /^# group: (.+)$/.exec(line);
    if (groupMatch) {
      group = capture(groupMatch, 1);
      continue;
    }
    const subgroupMatch = /^# subgroup: (.+)$/.exec(line);
    if (subgroupMatch) {
      subcategory = capture(subgroupMatch, 1);
      continue;
    }
    const rowMatch =
      /^([0-9A-F ]+?)\s*;\s*(fully-qualified|minimally-qualified|unqualified|component)\s*#\s*(\S+)\s+E([0-9.]+)\s+(.+?)\s*$/.exec(
        line
      );
    if (!rowMatch) continue;
    const cps = parseUnicode(capture(rowMatch, 1));
    if (
      cps.length === 0 ||
      cps.some((point) => !Number.isInteger(point) || point < 0 || point > 0x10ffff)
    ) {
      throw new Error(`invalid codepoint row: ${line}`);
    }
    rows.push({
      cps,
      unicode: fromCodepoints(cps),
      status: capture(rowMatch, 2),
      group,
      subcategory,
      sortOrder: rowMatch[2] === 'fully-qualified' ? sortOrder++ : -1,
      emojiVersion: capture(rowMatch, 4),
      sourceName: capture(rowMatch, 5),
    });
  }
  return rows;
}

function decodeXml(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, key: string) => {
    if (key[0] === '#') {
      const point =
        key[1]?.toLowerCase() === 'x'
          ? Number.parseInt(key.slice(2), 16)
          : Number.parseInt(key.slice(1), 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[key.toLowerCase()] ?? entity;
  });
}

function parseCldr(texts: readonly string[]): Map<string, { name?: string; keywords: string[] }> {
  const annotations = new Map<string, { name?: string; keywords: string[] }>();
  for (const text of texts) {
    const pattern = /<annotation\b([^>]*)>([\s\S]*?)<\/annotation>/g;
    for (const match of text.matchAll(pattern)) {
      const attrs = capture(match, 1);
      const cp = /\bcp="([^"]+)"/.exec(attrs)?.[1];
      if (!cp) continue;
      const unicode = decodeXml(cp);
      const content = decodeXml(capture(match, 2)).trim();
      const entry = annotations.get(unicode) ?? { keywords: [] };
      if (/\btype="tts"/.test(attrs)) {
        if (!entry.name) entry.name = content;
      } else {
        entry.keywords.push(
          ...content
            .split('|')
            .map((word) => word.trim())
            .filter(Boolean)
        );
      }
      annotations.set(unicode, entry);
    }
  }
  return annotations;
}

function shortcodeStem(name: string): string {
  const keycap = /^keycap:\s*(.+)$/i.exec(name.trim());
  if (keycap) {
    const rest = (keycap[1] ?? '').trim();
    if (rest === '#') return 'keycap_number_sign';
    if (rest === '*') return 'keycap_asterisk';
    if (/^[0-9]{1,2}$/.test(rest)) return `keycap_${rest}`;
  }
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'emoji'
  );
}

function parseLegacy(text: string): Map<string, LegacyRow> {
  const data = JSON.parse(text) as Record<string, LegacyRow>;
  const rows = new Map<string, LegacyRow>();
  for (const [unicode, row] of Object.entries(data)) {
    if (
      !row ||
      typeof row.char !== 'string' ||
      typeof row.slug !== 'string' ||
      !Array.isArray(row.keywords)
    ) {
      throw new Error(`invalid legacy row at ${JSON.stringify(unicode)}`);
    }
    rows.set(row.char || unicode, row);
  }
  return rows;
}

function normalizeLegacyAlias(value: string): string | undefined {
  const alias = value.trim();
  if (/^:[a-z0-9_+-]+:$/i.test(alias)) return alias.slice(1, -1).toLowerCase();
  if (/^[a-z0-9_+-]+$/i.test(alias)) return alias.toLowerCase();
  return undefined;
}

function buildAliasData(records: EmojiRecord[], legacyRows: Map<string, LegacyRow>) {
  const exact = new Map(records.map((record) => [record.unicode, record]));
  const normalized = new Map<string, EmojiRecord[]>();
  for (const record of records) {
    const key = qualificationKey(record.codepoints.map((point) => Number.parseInt(point, 16)));
    const matches = normalized.get(key) ?? [];
    matches.push(record);
    normalized.set(key, matches);
  }
  const getRecord = (unicode: string) => {
    const direct = exact.get(unicode);
    if (direct) return direct;
    const key = qualificationKey(Array.from(unicode, (char) => char.codePointAt(0) ?? 0));
    const matches = normalized.get(key) ?? [];
    return matches.length === 1 ? matches[0] : undefined;
  };

  const aliasesById = new Map<string, Set<string>>();
  const candidates = new Map<string, Set<string>>();
  const slugs = new Map<string, string>();
  const unmappedLegacy: string[] = [];
  for (const [unicode, row] of legacyRows) {
    const record = getRecord(unicode);
    if (!record) {
      unmappedLegacy.push(unicode);
      continue;
    }
    const exactMatch = exact.get(unicode) === record;
    if (exactMatch || !slugs.has(record.id)) slugs.set(record.id, row.slug);
    const aliases = [
      ...new Set(
        [row.slug, ...row.keywords]
          .map(normalizeLegacyAlias)
          .filter((alias): alias is string => alias !== undefined)
      ),
    ];
    const own = aliasesById.get(record.id) ?? new Set<string>();
    for (const alias of aliases) {
      own.add(alias);
      const ids = candidates.get(alias) ?? new Set<string>();
      ids.add(record.id);
      candidates.set(alias, ids);
    }
    aliasesById.set(record.id, own);
  }

  for (const record of records) record.aliases = [...(aliasesById.get(record.id) ?? [])].sort();

  const texuli: Record<string, string> = {};
  const legacy: Record<string, string> = {};
  for (const record of records) {
    const stem = record.shortcode.slice(1, -1);
    texuli[stem] = record.id;
  }
  const conflicts: {
    dialect: 'legacy';
    alias: string;
    candidates: string[];
    permissiveId: string;
    policy: string;
  }[] = [];
  const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  for (const [alias, idSet] of [...candidates].sort(([a], [b]) => lexical(a, b))) {
    const ids = [...idSet].sort((a, b) => {
      const left = recordsById.get(a);
      const right = recordsById.get(b);
      if (!left || !right) return lexical(a, b);
      return left.sortOrder - right.sortOrder || lexical(left.id, right.id);
    });
    const preferredId = ids.at(0);
    if (!preferredId) throw new Error(`legacy alias has no candidate: ${alias}`);
    if (ids.length === 1) legacy[alias] = preferredId;
    else
      conflicts.push({
        dialect: 'legacy',
        alias,
        candidates: ids,
        permissiveId: preferredId,
        policy: 'strict mode reports ambiguity; permissive mode picks earliest CLDR sortOrder',
      });
  }
  return {
    dialects: { texuli, legacy },
    slugs: Object.fromEntries([...slugs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    conflicts,
    legacySourceRows: legacyRows.size,
    legacyMappedRows: legacyRows.size - unmappedLegacy.length,
    unmappedLegacy,
  };
}

let recordsById = new Map<string, EmojiRecord>();

function buildCatalog(): { catalog: EmojiCatalog; aliases: ReturnType<typeof buildAliasData> } {
  const lock = JSON.parse(read('sources.lock.json')) as SourceLock;
  verifySources(lock);
  const parsed = parseEmojiTest(read('unicode-18.0.0/emoji-test.txt'));
  const fullyQualified = parsed.filter((row) => row.status === 'fully-qualified');
  const declaredCount = /# fully-qualified\s*:\s*(\d+)/.exec(
    read('unicode-18.0.0/emoji-test.txt')
  )?.[1];
  if (!declaredCount || fullyQualified.length !== Number(declaredCount)) {
    throw new Error(
      `Unicode 18.0 fully-qualified count mismatch: file declares ${declaredCount ?? 'no count'}, parsed ${fullyQualified.length}`
    );
  }

  const aliasRows = new Map<string, string[]>();
  const keyCounts = new Map<string, number>();
  for (const row of fullyQualified) {
    const key = qualificationKey(row.cps);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  for (const row of parsed) {
    if (row.status === 'fully-qualified' || row.status === 'component') continue;
    const key = qualificationKey(row.cps);
    if (keyCounts.get(key) === 1) {
      const ids = aliasRows.get(key) ?? [];
      ids.push(row.unicode);
      aliasRows.set(key, ids);
    }
  }

  const cldr = parseCldr([read('cldr-49/en.xml'), read('cldr-49/en-derived.xml')]);
  const names = new Map<string, string>();
  for (const row of fullyQualified) {
    const annotation = cldr.get(row.unicode);
    names.set(row.unicode, annotation?.name ?? row.sourceName);
  }
  const stemCounts = new Map<string, number>();
  for (const [, name] of names)
    stemCounts.set(shortcodeStem(name), (stemCounts.get(shortcodeStem(name)) ?? 0) + 1);

  const records: EmojiRecord[] = fullyQualified.map((row) => {
    const id = codepointId(row.cps);
    const name = names.get(row.unicode);
    if (!name) throw new Error(`missing CLDR name for ${codepointId(row.cps)}`);
    let stem = shortcodeStem(name);
    if ((stemCounts.get(stem) ?? 0) > 1) stem += `_${id.replaceAll('-', '_')}`;
    const annotation = cldr.get(row.unicode);
    const keywords = [
      ...new Set(
        [name, ...(annotation?.keywords ?? []), ...name.toLowerCase().split(/\s+/)]
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    const cpTone = row.cps.find((cp) => TONES[cp] !== undefined);
    return {
      id,
      unicode: row.unicode,
      codepoints: row.cps.map((cp) => cp.toString(16).toUpperCase()),
      name,
      shortcode: `:${stem}:`,
      aliases: [],
      category: categoryFromGroup(row.group),
      subcategory: row.subcategory,
      sortOrder: row.sortOrder,
      emojiVersion: row.emojiVersion,
      keywords,
      qualificationAliases: [...new Set(aliasRows.get(qualificationKey(row.cps)) ?? [])].filter(
        (alias) => alias !== row.unicode
      ),
      ...(cpTone === undefined ? {} : { tone: TONES[cpTone] }),
      artAvailable: false,
    };
  });

  const idSet = new Set<string>();
  const unicodeSet = new Set<string>();
  const shortcodeSet = new Set<string>();
  for (const record of records) {
    if (idSet.has(record.id)) throw new Error(`duplicate emoji id: ${record.id}`);
    if (unicodeSet.has(record.unicode)) throw new Error(`duplicate Unicode sequence: ${record.id}`);
    if (shortcodeSet.has(record.shortcode))
      throw new Error(`duplicate canonical shortcode: ${record.shortcode}`);
    idSet.add(record.id);
    unicodeSet.add(record.unicode);
    shortcodeSet.add(record.shortcode);
  }

  recordsById = new Map(records.map((record) => [record.id, record]));
  for (const record of records) {
    if (!record.tone) continue;
    const base = record.codepoints.filter(
      (point) => !Object.hasOwn(TONES, Number.parseInt(point, 16))
    );
    const baseId = codepointId(base.map((point) => Number.parseInt(point, 16)));
    const parent = recordsById.get(baseId);
    if (parent) {
      record.variantOf = parent.id;
      parent.variants = [...(parent.variants ?? []), record.id];
    }
  }

  const aliases = buildAliasData(records, parseLegacy(read(lock.legacy.path)));
  const catalog: EmojiCatalog = {
    schemaVersion: 'texuli-emoji/v1',
    unicodeEmojiVersion: '18.0',
    cldrVersion: '49',
    catalogVersion: '18.0.0+cldr.49',
    generatedAt: lock.capturedAt,
    records,
  };
  return { catalog, aliases };
}

function schemaDocument(recordCount: number) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://texuli.com/schemas/texuli-emoji-v1.json',
    title: 'Texuli Emoji catalog v1',
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'unicodeEmojiVersion',
      'cldrVersion',
      'catalogVersion',
      'generatedAt',
      'records',
    ],
    properties: {
      schemaVersion: { const: 'texuli-emoji/v1' },
      unicodeEmojiVersion: { type: 'string', const: '18.0' },
      cldrVersion: { type: 'string', const: '49' },
      catalogVersion: { type: 'string', const: '18.0.0+cldr.49' },
      generatedAt: { type: 'string', format: 'date' },
      records: {
        type: 'array',
        minItems: recordCount,
        maxItems: recordCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'unicode',
            'codepoints',
            'name',
            'shortcode',
            'aliases',
            'category',
            'subcategory',
            'sortOrder',
            'emojiVersion',
            'keywords',
            'qualificationAliases',
            'artAvailable',
          ],
          properties: {
            id: { type: 'string', pattern: '^[0-9a-f]+(?:-[0-9a-f]+)*$' },
            unicode: { type: 'string', minLength: 1 },
            codepoints: {
              type: 'array',
              minItems: 1,
              items: { type: 'string', pattern: '^[0-9A-F]{1,6}$' },
            },
            name: { type: 'string', minLength: 1 },
            shortcode: { type: 'string', pattern: '^:[a-z0-9_]+:$' },
            aliases: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
            category: { enum: Object.values(CATEGORY) },
            subcategory: { type: 'string', minLength: 1 },
            sortOrder: { type: 'integer', minimum: 0, maximum: recordCount - 1 },
            emojiVersion: { type: 'string', pattern: '^[0-9]+(?:\\.[0-9]+)*$' },
            keywords: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
            qualificationAliases: { type: 'array', uniqueItems: true, items: { type: 'string' } },
            variantOf: { type: 'string', pattern: '^[0-9a-f]+(?:-[0-9a-f]+)*$' },
            variants: { type: 'array', uniqueItems: true, items: { type: 'string' } },
            tone: { enum: Object.values(TONES).filter(Boolean) },
            artAvailable: { const: false },
          },
        },
      },
    },
  };
}

/** Where a generated file lives: the Kotlin catalog under `generated/kotlin`, the rest in `src/data`. */
export function outputPath(name: string): string {
  return name.startsWith('kotlin/')
    ? resolve(KOTLIN_DIR, name.slice('kotlin/'.length))
    : resolve(DATA_DIR, name);
}

function serializeJson(value: unknown): string {
  const stringify = (item: unknown): string =>
    (JSON.stringify(item) ?? 'null').replace(
      /(?:[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]|[\ufe00-\ufe0f]|\u20e3|[\u{e0020}-\u{e007f}])/gu,
      (character) => {
        const point = character.codePointAt(0) ?? 0;
        if (point <= 0xffff) return `\\u${point.toString(16).padStart(4, '0')}`;
        const adjusted = point - 0x10000;
        return `\\u${(0xd800 + (adjusted >> 10)).toString(16)}\\u${(0xdc00 + (adjusted & 0x3ff)).toString(16)}`;
      }
    );
  const print = (current: unknown, depth: number): string => {
    const padding = '  '.repeat(depth);
    if (Array.isArray(current)) {
      if (current.length === 0) return '[]';
      if (
        current.every(
          (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item)
        )
      ) {
        const inline = `[${current.map(stringify).join(', ')}]`;
        if (padding.length + inline.length <= 100) return inline;
      }
      const nested = current.map((item) => `${'  '.repeat(depth + 1)}${print(item, depth + 1)}`);
      return `[\n${nested.join(',\n')}\n${padding}]`;
    }
    if (current !== null && typeof current === 'object') {
      const entries = Object.entries(current);
      if (entries.length === 0) return '{}';
      const nested = entries.map(
        ([key, item]) => `${'  '.repeat(depth + 1)}${stringify(key)}: ${print(item, depth + 1)}`
      );
      return `{\n${nested.join(',\n')}\n${padding}}`;
    }
    return stringify(current);
  };
  return `${print(value, 0)}\n`;
}

/**
 * Biome-formatted JSON for the files lint checks: Biome's formatter is the source of truth for line
 * width (it measures emoji and escapes differently from string length). Files of 1 MiB or more are
 * skipped by Biome (files.maxSize), so they keep the generator's own layout.
 */
function biomeJson(name: string, json: string): string {
  if (Buffer.byteLength(json) >= 1024 * 1024) return json;
  return execFileSync(
    resolve(ROOT, 'node_modules/.bin/biome'),
    ['format', `--stdin-file-path=packages/emojis/src/data/${name}`],
    { cwd: ROOT, input: json, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
}

export function generateFiles(): Record<string, string> {
  const { catalog, aliases } = buildCatalog();
  const catalogJson = serializeJson(catalog);
  const aliasesJson = serializeJson({
    schemaVersion: 'texuli-emoji/v1',
    policy: {
      canonical: 'Texuli canonical shortcode is unique and wins in the texuli dialect.',
      legacy:
        'Unambiguous imported aliases resolve in legacy; conflicts are separated for strict refusal or deterministic permissive fallback. The writer emits the 3.0.2 slug; keywords are read-only aliases.',
      permissiveConflict: 'earliest CLDR sortOrder, then canonical id',
      unknown: 'leave unchanged',
    },
    migration: {
      source: 'universal-emoji-parser@3.0.2',
      sourceRows: aliases.legacySourceRows,
      mappedRows: aliases.legacyMappedRows,
      unmappedUnicode: aliases.unmappedLegacy,
    },
    dialects: aliases.dialects,
    slugs: aliases.slugs,
    conflicts: aliases.conflicts,
  });
  const schemaJson = serializeJson(schemaDocument(catalog.records.length));
  const unicodeIndexJson = serializeJson(
    catalog.records.flatMap(({ id, unicode, shortcode, qualificationAliases }) => [
      [unicode, id, shortcode],
      ...qualificationAliases.map((alias) => [alias, id, shortcode]),
    ])
  );
  const catalogTs = [
    '/** Generated by scripts/emojis/generate-catalog.ts. Do not edit. */',
    '',
    "import catalog from './catalog.json' with { type: 'json' };",
    "import type { EmojiCatalog } from './schema.ts';",
    'export const emojiCatalog = catalog as EmojiCatalog;',
    "export type { EmojiCatalog, EmojiCategory, EmojiRecord } from './schema.ts';",
    '',
  ].join('\n');
  const legacyTs = [
    '/** Generated by scripts/emojis/generate-catalog.ts. Do not edit. */',
    '',
    "import aliasIndex from './aliases.json' with { type: 'json' };",
    "import type { EmojiAliasIndex } from './schema.ts';",
    'export const emojiAliases = aliasIndex as EmojiAliasIndex;',
    "export type { EmojiAliasConflict, EmojiAliasIndex } from './schema.ts';",
    '',
  ].join('\n');
  const indexTs = [
    '/** Generated by scripts/emojis/generate-catalog.ts. Do not edit. */',
    "export { emojiCatalog } from './catalog.ts';",
    "export { emojiAliases } from './legacy.ts';",
    'export type {',
    '  EmojiAliasConflict,',
    '  EmojiAliasIndex,',
    '  EmojiCatalog,',
    '  EmojiCategory,',
    '  EmojiRecord,',
    "} from './schema.ts';",
    '',
  ].join('\n');
  return {
    'catalog.json': biomeJson('catalog.json', catalogJson),
    'aliases.json': biomeJson('aliases.json', aliasesJson),
    'schema.json': biomeJson('schema.json', schemaJson),
    // A TS module, not a JSON import: the lean engine is on the remote MCP's edge path, and the
    // Cloudflare Pages Functions build cannot parse import attributes (see tools/ops/version.ts).
    'unicode-index.ts': biomeJson(
      'unicode-index.ts',
      `/** Generated by scripts/emojis/generate-catalog.ts. Do not edit. Rows: [unicode, id, shortcode]. */\nexport const SEQUENCE_ROWS: readonly (readonly [string, string, string])[] = ${unicodeIndexJson.trimEnd()};\n`
    ),
    'catalog.ts': catalogTs,
    'legacy.ts': legacyTs,
    'index.ts': indexTs,
    ...kotlinCatalog(catalog.records),
  };
}

export function run(options: { check?: boolean } = {}): void {
  const files = generateFiles();
  let changed = false;
  for (const [name, expected] of Object.entries(files)) {
    const path = outputPath(name);
    let actual = '';
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      // Missing generated output is reported in --check mode and written otherwise.
    }
    if (actual !== expected) {
      changed = true;
      const label = name.startsWith('kotlin/')
        ? `packages/emojis/generated/${name.slice('kotlin/'.length)}`
        : `packages/emojis/src/data/${name}`;
      if (options.check) console.error(`out of date: ${label}`);
      else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, expected);
      }
    }
  }
  const expectedChunks = new Set(
    Object.keys(files)
      .filter((name) => name.startsWith('kotlin/'))
      .map((name) => name.slice('kotlin/'.length))
  );
  let staleKotlin = false;
  let generatedKotlinFiles: string[] = [];
  try {
    generatedKotlinFiles = readdirSync(KOTLIN_DIR).filter((name) =>
      /^EmojiCatalogChunk\d+\.kt$/.test(name)
    );
  } catch {
    // Missing generated output is handled by the expected file checks.
  }
  for (const name of generatedKotlinFiles) {
    if (expectedChunks.has(name)) continue;
    staleKotlin = true;
    if (options.check)
      console.error(`stale generated file: packages/emojis/generated/kotlin/${name}`);
    else unlinkSync(resolve(KOTLIN_DIR, name));
  }
  changed ||= staleKotlin;
  if (options.check && changed)
    throw new Error('emoji catalog outputs are stale; run the generator');
  const recordCount = (JSON.parse(files['catalog.json']) as EmojiCatalog).records.length;
  console.log(
    `${options.check ? 'checked' : 'generated'} ${recordCount} Unicode Emoji 18.0 records`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--check'))
      throw new Error('usage: generate-catalog.ts [--check]');
    run({ check: args.includes('--check') });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
