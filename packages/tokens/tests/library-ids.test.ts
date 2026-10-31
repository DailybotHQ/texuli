// @vitest-environment node
/**
 * `@texuli/tokens/library-ids` (G125): every library theme id with no
 * metadata, generated from the libraries' own sources, so a host validates
 * an id synchronously without loading the catalog rows.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderLibraryIds } from '../scripts/render-library.ts';
import {
  BUILTIN_PRESET_IDS,
  EXPAND_THEME_LIBRARY_META,
  getFullThemeLibraryMeta,
} from '../src/library-expand/index.ts';
import {
  BUILTIN_THEME_IDS,
  EXPAND_THEME_IDS,
  isLibraryThemeId,
  LIBRARY_THEME_IDS,
  type LibraryThemeId,
  type LibraryThemeSet,
  libraryThemeSet,
  PORT_THEME_IDS,
} from '../src/library-ids/index.ts';
import { THEME_LIBRARY_META } from '../src/library-port/index.ts';

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('@texuli/tokens/library-ids (G125)', () => {
  it('lists the union of the three libraries, 210 ids, in the full catalog order', async () => {
    const full = (await getFullThemeLibraryMeta()).map((meta) => meta.id);
    expect(full).toHaveLength(210);
    expect([...LIBRARY_THEME_IDS]).toEqual(full);
    expect([...PORT_THEME_IDS]).toEqual(THEME_LIBRARY_META.map((meta) => meta.id));
    expect([...BUILTIN_THEME_IDS]).toEqual([...BUILTIN_PRESET_IDS]);
    expect([...BUILTIN_THEME_IDS, ...EXPAND_THEME_IDS]).toEqual(
      EXPAND_THEME_LIBRARY_META.map((meta) => meta.id)
    );
    expect(Object.isFrozen(LIBRARY_THEME_IDS)).toBe(true);
  });

  it('keeps the built-in, port and expand sets disjoint, and names the set of every id', () => {
    const sets: Record<LibraryThemeSet, readonly string[]> = {
      builtin: BUILTIN_THEME_IDS,
      port: PORT_THEME_IDS,
      expand: EXPAND_THEME_IDS,
    };
    expect([BUILTIN_THEME_IDS.length, PORT_THEME_IDS.length, EXPAND_THEME_IDS.length]).toEqual([
      6, 64, 140,
    ]);
    const union = new Set(Object.values(sets).flat());
    expect(union.size).toBe(6 + 64 + 140);
    for (const [set, ids] of Object.entries(sets)) {
      for (const id of ids) {
        expect(isLibraryThemeId(id), id).toBe(true);
        expect(libraryThemeSet(id), id).toBe(set);
      }
    }
  });

  it('rejects anything that is not a library id, own-property safe', () => {
    for (const value of [
      '',
      'Violet',
      ' violet',
      'not-a-theme',
      'toString',
      '__proto__',
      'constructor',
      'hasOwnProperty',
      null,
      undefined,
      42,
      {},
      ['violet'],
    ]) {
      expect(isLibraryThemeId(value), String(value)).toBe(false);
      expect(libraryThemeSet(value), String(value)).toBeUndefined();
    }
    const id: unknown = 'harbor-teal';
    if (isLibraryThemeId(id)) {
      const narrowed: LibraryThemeId = id;
      expect(narrowed).toBe('harbor-teal');
    }
  });

  it('is generated from the library sources (no drift) and imports no metadata', async () => {
    const dir = join(PACKAGE, 'src/library-ids');
    expect(readFileSync(join(dir, 'ids.ts'), 'utf8')).toBe(await renderLibraryIds());
    for (const file of readdirSync(dir)) {
      const source = readFileSync(join(dir, file), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
      expect(
        imports.filter((spec) => spec !== './ids.ts'),
        file
      ).toEqual([]);
      expect(source, file).not.toMatch(/import\(/);
    }
    const pkg = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports['./library-ids']).toBe('./src/library-ids/index.ts');
  });
});
