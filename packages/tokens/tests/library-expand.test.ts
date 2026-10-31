// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderExpandMetadata } from '../scripts/render-library.ts';
import {
  BUILTIN_PRESET_IDS,
  clearExpandThemeCache,
  EXPAND_THEME_LIBRARY_META,
  getExpandThemeMeta,
  getFullThemeLibraryMeta,
  listExpandThemeLibrary,
  listFullCollections,
  listThemeLibrary,
  loadAllExpandThemes,
  loadExpandTheme,
  loadExpandThemeDefinition,
  loadFullLibraryTheme,
  searchExpandThemeLibrary,
  searchThemeLibrary,
} from '../src/library-expand/index.ts';
import {
  loadLibraryThemeDefinition,
  THEME_LIBRARY_META as PORT_META,
} from '../src/library-port/index.ts';
import { contrastRatio } from '../src/palette/index.ts';

const TEXT_PAIRS = [
  ['background', 'foreground'],
  ['surface', 'surfaceForeground'],
  ['elevated', 'elevatedForeground'],
  ['muted', 'mutedForeground'],
  ['primary', 'primaryForeground'],
  ['secondary', 'secondaryForeground'],
  ['destructive', 'destructiveForeground'],
  ['success', 'successForeground'],
  ['successSoft', 'successSoftForeground'],
  ['warning', 'warningForeground'],
  ['warningSoft', 'warningSoftForeground'],
  ['info', 'infoForeground'],
  ['infoSoft', 'infoSoftForeground'],
  ['destructiveSoft', 'destructiveSoftForeground'],
  ['primarySoft', 'primarySoftForeground'],
] as const;

describe('library expand catalog (T-tokens-library-expand)', () => {
  it('ships 146 expand themes: 6 Protoyard builtins first, then 140 curated, and 5 related cases', async () => {
    // ships 146 expand themes: 6 Protoyard builtins first, then 140 curated
    expect(EXPAND_THEME_LIBRARY_META).toHaveLength(146);
    expect(new Set(EXPAND_THEME_LIBRARY_META.map((m) => m.id)).size).toBe(146);
    expect(BUILTIN_PRESET_IDS).toEqual([
      'violet',
      'ocean',
      'emerald',
      'rose',
      'amber',
      'monochrome',
    ]);
    expect(EXPAND_THEME_LIBRARY_META.slice(0, 6).map((m) => m.id)).toEqual([...BUILTIN_PRESET_IDS]);
    for (const id of BUILTIN_PRESET_IDS) {
      expect(getExpandThemeMeta(id)?.category).toBe('builtin');
      expect(getExpandThemeMeta(id)?.tags).toContain('builtin');
    }
    expect(EXPAND_THEME_LIBRARY_META.filter((m) => m.category !== 'builtin')).toHaveLength(140);
    // listThemeLibrary/search return all 210 themes (port + expand)
    await (async () => {
      expect(PORT_META).toHaveLength(64);
      const full = await getFullThemeLibraryMeta();
      expect(full).toHaveLength(64 + 146);
      expect(full.length).toBeGreaterThanOrEqual(200);
      expect(new Set(full.map((m) => m.id)).size).toBe(full.length);

      const listed = await listThemeLibrary();
      expect(listed).toHaveLength(210);

      const portIds = new Set(PORT_META.map((m) => m.id));
      for (const meta of EXPAND_THEME_LIBRARY_META) {
        expect(portIds.has(meta.id), meta.id).toBe(false);
      }

      const found = await searchThemeLibrary('harbor teal');
      expect(found[0]?.id).toBe('harbor-teal');
      expect(await searchThemeLibrary('violet')).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'violet' })])
      );

      const collections = await listFullCollections();
      expect(collections.reduce((n, c) => n + c.count, 0)).toBe(210);
    })();
    {
      // covers curated families and expand-only search without loading tokens
      const families = [
        'neutral',
        'warm',
        'cool',
        'vivid',
        'pastel',
        'earthy',
        'brand-like',
        'editorial',
        'terminal',
        'high-contrast',
      ];
      for (const family of families) {
        expect(listExpandThemeLibrary({ category: family }).length, family).toBeGreaterThanOrEqual(
          14
        );
      }
      expect(listExpandThemeLibrary({ collection: 'high-contrast' }).length).toBeGreaterThanOrEqual(
        14
      );
      expect(searchExpandThemeLibrary('violet builtin')[0]?.id).toBe('violet');
    }
    // builds every expand theme with AA (or AAA) text pairs
    // The six builtin ports are the first expand themes, so the next gate covers them.
    await (async () => {
      clearExpandThemeCache();
      for (const meta of EXPAND_THEME_LIBRARY_META) {
        const theme = await loadExpandTheme(meta.id);
        const minimum = meta.contrastLevel === 'AAA' ? 7 : 4.5;
        for (const mode of ['light', 'dark'] as const) {
          const palette = theme[mode];
          for (const [bg, fg] of TEXT_PAIRS) {
            expect(
              contrastRatio(palette[fg].default, palette[bg].default),
              `${meta.id} ${mode} ${bg}/${fg}`
            ).toBeGreaterThanOrEqual(minimum);
          }
          expect(
            contrastRatio(palette.link.default, palette.background.default),
            `${meta.id} ${mode} link`
          ).toBeGreaterThanOrEqual(minimum);
        }
      }
    })();
    // routes full-catalog loads to port or expand
    await (async () => {
      const port = await loadFullLibraryTheme('harbor-teal');
      expect(port.id).toBe('harbor-teal');
      const expand = await loadFullLibraryTheme('ocean');
      expect(expand.id).toBe('ocean');
      expect(expand.name).toBe('Ocean');
    })();
    // loadAllExpandThemes returns 146 validated themes
    await (async () => {
      clearExpandThemeCache();
      const themes = await loadAllExpandThemes();
      expect(themes).toHaveLength(146);
      expect(themes[0]?.id).toBe('violet');
    })();
  }, 240000);
});

describe('library metadata descriptions (G126)', () => {
  // A complete sentence ends with terminal punctuation (a closing parenthesis may follow it).
  const COMPLETE = /[.!?][)"']?$/;

  it('gives every expand and port metadata row a complete sentence that the definition starts with', async () => {
    const libraries = [
      { meta: EXPAND_THEME_LIBRARY_META, load: loadExpandThemeDefinition },
      { meta: PORT_META, load: loadLibraryThemeDefinition },
    ];
    let checked = 0;
    for (const { meta, load } of libraries) {
      for (const row of meta) {
        const full = (await load(row.id)).description;
        expect(row.description, row.id).toMatch(COMPLETE);
        expect(full.startsWith(row.description), row.id).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBe(210);
    expect(
      EXPAND_THEME_LIBRARY_META.find((row) => row.id === 'terracotta-hearth')?.description
    ).toBe('Terracotta Hearth: curated warm family theme for the expanded library.');
  });

  it('keeps the expand rows generated from the definition modules (no drift)', async () => {
    const file = new URL('../src/library-expand/metadata.ts', import.meta.url);
    expect(readFileSync(file, 'utf8')).toBe(await renderExpandMetadata());
  });
});
