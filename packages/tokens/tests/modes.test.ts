import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEMANTIC_ROLES } from '../src/contract/index.ts';
import { type SemanticPalette } from '../src/contract/semantic.ts';
import { type Theme } from '../src/contract/types.ts';
import {
  applyColorMode,
  COLOR_MODE_NAMES,
  clearColorMode,
  colorModeBootstrapScript,
  colorModeStorageKey,
  colorSchemeValue,
  createHighContrastPalette,
  defineTheme,
  getSystemPreferences,
  resolveColorMode,
  resolveSemanticPalette,
  type SemanticPaletteInput,
} from '../src/index.ts';
import {
  APPEARANCE_CACHE_VERSION,
  type AppliedAppearance,
  appearanceCacheKey,
  cacheAppearance,
  noFlashScript,
  readCachedAppearance,
} from '../src/no-flash/index.ts';
import {
  applyStylePresets,
  DEFAULT_TARGET_SIZE_PX,
  DENSITY_PRESETS,
  densityScale,
  densityTargetSize,
  ELEVATION_PRESETS,
  FONT_CATALOG,
  FONT_PRESETS,
  getFontPairing,
  loadVariableFont,
  MIN_TARGET_SIZE_PX,
  MOTION_PRESETS,
  RADIUS_PRESETS,
  REDUCED_MOTION,
  stylePresetInput,
  TYPE_SCALE_PRESETS,
} from '../src/style-presets/index.ts';

function palette(color: string): SemanticPalette {
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => [role, { default: color }])
  ) as SemanticPalette;
}

const theme: Pick<Theme, 'light' | 'dark'> = {
  light: palette('#eeeeee'),
  dark: palette('#111111'),
};

function mediaPreferences(matches: Readonly<Record<string, boolean>>) {
  return vi.fn((query: string) => ({ matches: matches[query] ?? false }));
}

describe('color mode resolution', () => {
  it('exposes explicit modes and resolves system color and contrast preferences; fails safely when matchMedia is missing or throws', () => {
    {
      // exposes explicit modes and resolves system color and contrast preferences
      expect(COLOR_MODE_NAMES).toEqual(['light', 'dark', 'high-contrast', 'system']);
      const dark = mediaPreferences({ '(prefers-color-scheme: dark)': true });
      const contrast = mediaPreferences({
        '(prefers-color-scheme: dark)': true,
        '(prefers-contrast: more)': true,
      });

      expect(getSystemPreferences(dark)).toEqual({
        colorScheme: 'dark',
        contrast: 'no-preference',
      });
      expect(resolveColorMode('system', dark)).toBe('dark');
      expect(resolveColorMode('system', contrast)).toBe('high-contrast');
      expect(resolveColorMode('system', mediaPreferences({}))).toBe('light');
      expect(resolveColorMode('light', contrast)).toBe('light');
      expect(resolveColorMode('high-contrast', dark)).toBe('high-contrast');
    }
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
    // fails safely when matchMedia is missing or throws
    expect(
      getSystemPreferences(() => {
        throw new Error('unavailable');
      })
    ).toEqual({ colorScheme: 'light', contrast: 'no-preference' });
    expect(
      resolveColorMode('system', () => {
        throw new Error('unavailable');
      })
    ).toBe('light');
  });
});

describe('high contrast palette', () => {
  it('maps every semantic role to a platform system color and includes interaction states, and 1 related cases', () => {
    {
      // maps every semantic role to a platform system color and includes interaction states
      const palette = createHighContrastPalette();
      expect(Object.keys(palette)).toEqual(SEMANTIC_ROLES);
      expect(palette.background.default).toBe('Canvas');
      expect(palette.foreground.default).toBe('CanvasText');
      expect(palette.primary.default).toBe('Highlight');
      expect(palette.primaryForeground.default).toBe('HighlightText');
      expect(palette.link.default).toBe('LinkText');
      expect(palette.primary.disabled).toBe('GrayText');
      expect(palette.primary.focus).toBe('Highlight');
      expect(createHighContrastPalette()).not.toBe(palette);
    }
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
    // selects authored palettes for light and dark, and system colors for high contrast
    expect(resolveSemanticPalette(theme, 'light')).toBe(theme.light);
    expect(resolveSemanticPalette(theme, 'dark')).toBe(theme.dark);
    expect(resolveSemanticPalette(theme, 'high-contrast').background.default).toBe('Canvas');
    expect(colorSchemeValue('light')).toBe('light');
    expect(colorSchemeValue('dark')).toBe('dark');
    expect(colorSchemeValue('high-contrast')).toBe('light dark');
  });
});

describe('mode application and first-paint bootstrap', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
  });
  it('applies explicit and system modes to an element and clears only mode state, and 3 related cases', () => {
    {
      // applies explicit and system modes to an element and clears only mode state
      const root = document.createElement('div');
      root.classList.add('custom');
      expect(
        applyColorMode(root, 'system', mediaPreferences({ '(prefers-contrast: more)': true }))
      ).toBe('high-contrast');
      expect(root.dataset.txMode).toBe('high-contrast');
      expect(root.style.colorScheme).toBe('light dark');
      expect(root.className).toBe('custom');

      applyColorMode(root, 'dark');
      expect(root.dataset.txMode).toBe('dark');
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.style.colorScheme).toBe('dark');
      clearColorMode(root);
      expect(root.dataset.txMode).toBeUndefined();
      expect(root.className).toBe('custom');
      expect(root.style.colorScheme).toBe('');
    }
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
    {
      // generates a namespace-specific inline script that validates storage and resolves system contrast
      const script = colorModeBootstrapScript('billing', 'system');
      expect(script).toContain('texuli.billing.mode');
      expect(script).toContain("m==='system'");
      expect(script).toContain('prefers-contrast: more');
      expect(script).toContain('prefers-color-scheme: dark');
      expect(script).toContain('dataset.txMode');
      expect(script).not.toContain('<script');
    }
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
    {
      // escapes script delimiters in a namespace and rejects an empty namespace
      const script = colorModeBootstrapScript('</script>&tenant');
      expect(script).not.toContain('</script>');
      expect(script).toContain('\\u003c/script\\u003e\\u0026tenant');
      expect(colorModeStorageKey(' billing ')).toBe('texuli.billing.mode');
      expect(() => colorModeBootstrapScript('  ')).toThrow(/namespace/i);
      expect(() => colorModeStorageKey('')).toThrow(/namespace/i);
      expect(() => colorModeBootstrapScript('x'.repeat(129))).toThrow(/namespace/i);
    }
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
    // uses system mode when a runtime caller passes an unknown fallback
    expect(colorModeBootstrapScript('dashboard', 'invalid' as never)).toContain('m="system"');
  });
});

describe('no-flash cache and bootstrap', () => {
  function storage(seed: Record<string, string> = {}) {
    const values = new Map(Object.entries(seed));
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      values,
    };
  }

  function root() {
    const classes = new Set<string>();
    const data: Record<string, string> = {};
    const variables = new Map<string, string>();
    const style = {
      colorScheme: '',
      setProperty: (name: string, value: string) => variables.set(name, value),
    };
    return {
      classList: {
        toggle(name: string, force: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
      dataset: data,
      style,
      classes,
      variables,
    };
  }

  function execute(
    script: string,
    documentRoot: ReturnType<typeof root>,
    localStorage: unknown,
    matchMedia: unknown
  ) {
    new Function('document', 'localStorage', 'matchMedia', script)(
      {
        documentElement: documentRoot,
      },
      localStorage,
      matchMedia
    );
  }

  const applied: AppliedAppearance = {
    themeId: 'ocean',
    mode: 'dark',
    vars: { '--tx-background': '#101820', '--tx-primary': '#33aacc' },
    reducedMotion: true,
    surface: 'glass',
    components: { button: 'pill', card: 'bordered', focusRing: 'outline', input: 'compact' },
  };

  describe('no-flash cache', () => {
    it('round-trips a resolved appearance with an application namespace, and 7 related cases', () => {
      {
        // round-trips a resolved appearance with an application namespace
        const store = storage();
        expect(cacheAppearance(' billing ', applied, store)).toBe(true);
        expect(appearanceCacheKey('billing')).toBe('texuli.billing.appearance');
        expect(readCachedAppearance('billing', store)).toEqual({
          v: APPEARANCE_CACHE_VERSION,
          ...applied,
        });
      }
      {
        // returns false or null when storage is unavailable, throws, or contains invalid JSON
        const unavailable = {
          setItem: () => {
            throw new Error('QuotaExceededError');
          },
          getItem: () => {
            throw new Error('SecurityError');
          },
        };
        expect(cacheAppearance('demo', applied, unavailable)).toBe(false);
        expect(readCachedAppearance('demo', unavailable)).toBeNull();
        expect(readCachedAppearance('demo', undefined)).toBeNull();
        expect(
          readCachedAppearance('demo', storage({ [appearanceCacheKey('demo')]: '{bad' }))
        ).toBe(null);
      }
      // rejects wrong versions and incomplete cache records
      for (const value of [
        { v: 2, ...applied },
        { v: APPEARANCE_CACHE_VERSION, ...applied, themeId: '../bad' },
        { v: APPEARANCE_CACHE_VERSION, ...applied, mode: 'system' },
        { v: APPEARANCE_CACHE_VERSION, ...applied, vars: [] },
      ]) {
        const store = storage({ [appearanceCacheKey('demo')]: JSON.stringify(value) });
        expect(readCachedAppearance('demo', store)).toBeNull();
      }
      {
        // validates namespace limits and escapes values embedded in an inline script
        expect(() => appearanceCacheKey(' ')).toThrow(/namespace/i);
        expect(() => noFlashScript('x'.repeat(129))).toThrow(/namespace/i);
        const script = noFlashScript('</script>&tenant');
        expect(script).not.toContain('</script>');
        expect(script).toContain('\\u003c/script\\u003e\\u0026tenant');
        expect(script).not.toContain('<script');
        expect(noFlashScript('</script>&tenant')).toBe(script);
      }
      {
        // replays stored theme tokens, metadata and mode before application code runs
        const store = storage();
        expect(cacheAppearance('demo', applied, store)).toBe(true);
        const documentRoot = root();
        execute(noFlashScript('demo'), documentRoot, store, () => ({ matches: false }));

        expect(documentRoot.variables.get('--tx-background')).toBe('#101820');
        expect(documentRoot.variables.get('--tx-primary')).toBe('#33aacc');
        expect(documentRoot.dataset).toEqual({
          txTheme: 'ocean',
          txMotion: 'reduce',
          txSurface: 'glass',
          txButtonStyle: 'pill',
          txCardStyle: 'bordered',
          txFocusRingStyle: 'outline',
          txInputStyle: 'compact',
          txMode: 'dark',
        });
        expect(documentRoot.classes.has('dark')).toBe(true);
        expect(documentRoot.style.colorScheme).toBe('dark');
      }
      {
        // ignores tampered property names and unsafe values while resolving system contrast
        const store = storage({
          [appearanceCacheKey('demo')]: JSON.stringify({
            v: APPEARANCE_CACHE_VERSION,
            themeId: 'ocean',
            mode: 'light',
            vars: {
              color: 'red',
              '--tx-primary': '#123456',
              '--tx-injected': 'red; color: blue',
              '--tx-angle': '<svg>',
              '--tx-image': 'url(https://example.org/pixel)',
            },
          }),
        });
        const documentRoot = root();
        execute(noFlashScript('demo', 'system'), documentRoot, store, (query: string) => ({
          matches: query === '(prefers-contrast: more)',
        }));

        expect(documentRoot.variables.get('color')).toBeUndefined();
        expect(documentRoot.variables.get('--tx-primary')).toBe('#123456');
        expect(documentRoot.variables.has('--tx-injected')).toBe(false);
        expect(documentRoot.variables.has('--tx-angle')).toBe(false);
        expect(documentRoot.variables.has('--tx-image')).toBe(false);
        expect(documentRoot.dataset.txMode).toBe('light');
        expect(documentRoot.style.colorScheme).toBe('light');
      }
      // falls back to the configured or system mode when storage is blocked
      for (const [fallback, expected] of [
        ['light', 'light'],
        ['dark', 'dark'],
        ['high-contrast', 'high-contrast'],
        ['system', 'dark'],
      ] as const) {
        const documentRoot = root();
        execute(
          noFlashScript('demo', fallback),
          documentRoot,
          {
            getItem: () => {
              throw new Error('SecurityError');
            },
          },
          (query: string) => ({
            matches: query === '(prefers-color-scheme: dark)',
          })
        );
        expect(documentRoot.dataset.txMode).toBe(expected);
      }
      {
        // uses system high contrast when there is no valid cached appearance
        const documentRoot = root();
        execute(noFlashScript('demo', 'system'), documentRoot, storage(), (query: string) => ({
          matches: query === '(prefers-contrast: more)',
        }));
        expect(documentRoot.dataset.txMode).toBe('high-contrast');
        expect(documentRoot.style.colorScheme).toBe('light dark');
      }
    });
  });
});

describe('style presets', () => {
  function palette(color: string): SemanticPaletteInput {
    return Object.fromEntries(SEMANTIC_ROLES.map((role) => [role, color])) as SemanticPaletteInput;
  }

  function baseTheme() {
    return defineTheme({
      id: 'preset-test',
      name: 'Preset test',
      light: palette('#ffffff'),
      dark: palette('#111111'),
      style: { typography: { scaleRatio: null }, shape: { radiusScale: 1, borderWidth: '1px' } },
    });
  }

  describe('style presets', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('keeps all preset ids unique and provides the four motion choices, and 5 related cases', async () => {
      // keeps all preset ids unique and provides the four motion choices
      for (const presets of [
        DENSITY_PRESETS,
        RADIUS_PRESETS,
        ELEVATION_PRESETS,
        MOTION_PRESETS,
        TYPE_SCALE_PRESETS,
        FONT_PRESETS,
      ]) {
        const ids = presets.map(({ id }) => id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      expect(MOTION_PRESETS.map(({ id }) => id)).toEqual([
        'none',
        'subtle',
        'standard',
        'expressive',
      ]);
      expect(FONT_PRESETS.map(({ id }) => id)).toEqual(FONT_CATALOG.map(({ id }) => id));
      vi.unstubAllGlobals();
      // clamps the global density and preserves a minimum 24 by 24 target
      expect(densityScale(undefined)).toBe(1);
      expect(densityScale(Number.NaN)).toBe(1);
      expect(densityScale(0.1)).toBe(0.75);
      expect(densityScale(2)).toBe(1.25);
      expect(MIN_TARGET_SIZE_PX).toBe(24);
      expect(densityTargetSize(0.75, 24)).toBe(24);
      expect(densityTargetSize(0.75, 32)).toBe(24);
      expect(densityTargetSize(1, DEFAULT_TARGET_SIZE_PX)).toBe(44);
      expect(densityTargetSize(1.25, 32)).toBe(40);
      expect(() => densityTargetSize(1, -1)).toThrow(RangeError);
      vi.unstubAllGlobals();
      {
        // resolves density, radius, elevation, type, font and motion selections
        const input = stylePresetInput({
          density: 'compact',
          radius: 'round',
          elevation: 'layered',
          font: 'editorial',
          motion: 'expressive',
          typeScale: 'display',
        });
        expect(input.density).toBe(0.875);
        expect(input.radius).toBe('1rem');
        expect(input.style.shape?.radiusScale).toBe(1.25);
        expect(input.style.elevation).toBe('layered');
        expect(input.style.typography?.scaleRatio).toBe(1.333);
        expect(input.style.motion).toEqual({
          durations: { fast: 200, base: 300, slow: 500 },
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        });
        expect(input.fontFamilyHeading).toMatch(/Georgia|Palatino/);
      }
      vi.unstubAllGlobals();
      {
        // applies reduced motion over a selected motion preset and preserves omitted fields
        const original = baseTheme();
        const next = applyStylePresets(original, {
          motion: 'expressive',
          typeScale: 'comfortable',
          reducedMotion: true,
        });
        expect(next.style.motion).toEqual(REDUCED_MOTION);
        expect(next.style.typography.scaleRatio).toBe(1.25);
        expect(next.style.shape).toEqual(original.style.shape);
        expect(next.light).toEqual(original.light);
      }
      vi.unstubAllGlobals();
      // rejects unknown preset ids with useful known ids
      expect(() => stylePresetInput({ density: 'roomy' as never })).toThrow(
        /Known presets: compact, default/
      );
      expect(() => stylePresetInput({ font: 'comic' })).toThrow(/Unknown font preset/);
      expect(() => stylePresetInput({ typeScale: 'huge' as never })).toThrow(
        /Unknown type scale preset/
      );
      vi.unstubAllGlobals();
      // uses local system font stacks and only loads same-origin woff2 assets explicitly
      await (async () => {
        expect(getFontPairing('system')?.fontFamily).toContain('system-ui');
        expect(
          FONT_CATALOG.every(
            (font) =>
              !/https?:\/\//i.test(font.fontFamily + font.fontFamilyHeading + font.fontFamilyMono)
          )
        ).toBe(true);

        const load = vi.fn(async () => ({}) as FontFace);
        class FontFaceStub {
          load = load;
        }
        vi.stubGlobal('FontFace', FontFaceStub);
        const fonts = { add: vi.fn() } as unknown as FontFaceSet;
        const target = { baseURI: 'https://example.test/app/', fonts } as unknown as Document;
        const face = await loadVariableFont(
          { family: 'Local Test', src: './fonts/test.woff2' },
          target
        );
        expect(face).toBeInstanceOf(FontFaceStub);
        expect(load).toHaveBeenCalledOnce();
        expect(fonts.add).toHaveBeenCalledWith(face);
        await expect(
          loadVariableFont({ family: 'Bad', src: 'https://fonts.example/test.woff2' }, target)
        ).rejects.toThrow(/same-origin/);
        await expect(
          loadVariableFont({ family: 'Bad', src: './font.woff' }, target)
        ).rejects.toThrow(/same-origin/);
      })();
    });
  });
});
