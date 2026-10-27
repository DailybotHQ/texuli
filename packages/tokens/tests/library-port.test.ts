// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  clearLibraryThemeCache,
  getLibraryThemeMeta,
  listCollections,
  listThemeLibrary,
  loadAllLibraryThemes,
  loadLibraryTheme,
  loadLibraryThemeCharts,
  loadLibraryThemeDefinition,
  searchThemeLibrary,
  THEME_LIBRARY_META,
} from '../src/library-port/index.ts';
import { contrastRatio, validateChartTokens } from '../src/palette/index.ts';

const TEXT_PAIRS = [
  ['background', 'foreground'],
  ['surface', 'surfaceForeground'],
  ['elevated', 'elevatedForeground'],
  ['muted', 'mutedForeground'],
  ['subtle', 'subtleForeground'],
  ['sidebar', 'sidebarForeground'],
  ['primary', 'primaryForeground'],
  ['secondary', 'secondaryForeground'],
  ['accent', 'accentForeground'],
  ['destructive', 'destructiveForeground'],
  ['success', 'successForeground'],
  ['successSoft', 'successSoftForeground'],
  ['warning', 'warningForeground'],
  ['warningSoft', 'warningSoftForeground'],
  ['info', 'infoForeground'],
  ['infoSoft', 'infoSoftForeground'],
  ['destructiveSoft', 'destructiveSoftForeground'],
  ['primarySoft', 'primarySoftForeground'],
  ['selection', 'selectionForeground'],
] as const;

describe('lazy theme library', () => {
  it('keeps 64 unique metadata records in the six source collections, and 5 related cases', async () => {
    // keeps 64 unique metadata records in the six source collections
    expect(THEME_LIBRARY_META).toHaveLength(64);
    expect(new Set(THEME_LIBRARY_META.map(({ id }) => id)).size).toBe(64);
    expect(listCollections()).toEqual([
      { id: 'industry', count: 40 },
      { id: 'brand-like', count: 8 },
      { id: 'high-contrast', count: 6 },
      { id: 'colorblind-safe', count: 4 },
      { id: 'seasonal', count: 2 },
      { id: 'mono', count: 4 },
    ]);
    expect(Object.isFrozen(THEME_LIBRARY_META)).toBe(true);
    expect(Object.isFrozen(THEME_LIBRARY_META[0]?.tags)).toBe(true);
    // filters and ranks catalog metadata deterministically without loading theme data
    expect(listThemeLibrary({ collection: 'colorblind-safe' })).toHaveLength(4);
    expect(listThemeLibrary({ tag: 'logistics' }).map(({ id }) => id)).toContain('harbor-teal');
    expect(searchThemeLibrary('')).toBe(THEME_LIBRARY_META);
    expect(searchThemeLibrary('shipping logistics')[0]?.id).toBe('harbor-teal');
    expect(searchThemeLibrary('NO-MATCH')).toEqual([]);
    expect(getLibraryThemeMeta('harbor-teal')?.collection).toBe('industry');
    expect(getLibraryThemeMeta('missing')).toBeUndefined();
    // loads full definitions only through the asynchronous definition boundary
    await (async () => {
      const definition = await loadLibraryThemeDefinition('accessible-high-contrast');
      expect(definition.contrastLevel).toBe('AAA');
      expect(definition.seed).toMatch(/^#[0-9a-f]{6}$/i);
      expect(await loadLibraryThemeDefinition('harbor-teal')).toMatchObject({
        id: 'harbor-teal',
        name: 'Harbor Teal',
        tags: ['logistics', 'shipping', 'operations'],
      });
    })();
    // builds validated light and dark themes whose text pairs meet their declared WCAG level
    await (async () => {
      clearLibraryThemeCache();
      const metas = [...THEME_LIBRARY_META];
      for (const meta of metas) {
        const theme = await loadLibraryTheme(meta.id);
        expect(theme.id).toBe(meta.id);
        expect(theme.name).toBe(meta.name);
        const minimum = meta.contrastLevel === 'AAA' ? 7 : 4.5;
        expect(theme.charts).toBeUndefined();
        for (const mode of ['light', 'dark'] as const) {
          const palette = theme[mode];
          for (const [background, foreground] of TEXT_PAIRS) {
            expect(
              contrastRatio(palette[foreground].default, palette[background].default),
              `${meta.id} ${mode} ${background}/${foreground}`
            ).toBeGreaterThanOrEqual(minimum);
          }
          expect(
            contrastRatio(palette.link.default, palette.background.default),
            `${meta.id} ${mode} link/background`
          ).toBeGreaterThanOrEqual(minimum);
          expect(
            contrastRatio(palette.linkVisited.default, palette.background.default),
            `${meta.id} ${mode} visited/background`
          ).toBeGreaterThanOrEqual(minimum);
        }
        const charts = await loadLibraryThemeCharts(meta.id);
        for (const mode of ['light', 'dark'] as const) {
          const palette = theme[mode];
          const chartPalette = {
            surface: palette.surface.default,
            background: palette.background.default,
            destructive: palette.destructive.default,
            border: palette.border.default,
            mutedForeground: palette.mutedForeground.default,
            chart1: charts[mode].categorical[0],
            chart2: charts[mode].categorical[1],
            chart3: charts[mode].categorical[2],
            chart4: charts[mode].categorical[3],
            chart5: charts[mode].categorical[4],
          };
          expect(
            validateChartTokens(
              {
                ...charts[mode],
                categorical: [...charts[mode].categorical],
                sequential: [...charts[mode].sequential],
                diverging: [...charts[mode].diverging],
              },
              chartPalette,
              mode
            )
          ).toEqual([]);
        }
      }
    })();
    // loads every definition in catalog order and does not expose cache mutations
    await (async () => {
      const all = await loadAllLibraryThemes();
      expect(all.map(({ id }) => id)).toEqual(THEME_LIBRARY_META.map(({ id }) => id));
      const first = await loadLibraryTheme('harbor-teal');
      first.light.background.default = '#000000';
      const second = await loadLibraryTheme('harbor-teal');
      expect(second.light.background.default).not.toBe('#000000');
      expect(second).toEqual(all.find(({ id }) => id === 'harbor-teal'));
      const charts = await loadLibraryThemeCharts('harbor-teal');
      (charts.light.categorical as unknown as string[])[0] = '#000000';
      expect((await loadLibraryThemeCharts('harbor-teal')).light.categorical[0]).not.toBe(
        '#000000'
      );
    })();
    // rejects unknown ids with the known catalog ids
    await (async () => {
      await expect(loadLibraryTheme('unknown')).rejects.toThrow(/Known ids:.*harbor-teal/);
      await expect(loadLibraryThemeDefinition('unknown')).rejects.toThrow(/Unknown library theme/);
    })();
  }, 30000);
});
