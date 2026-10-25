import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEMANTIC_ROLES } from '../src/contract/index.ts';
import { defineTheme, type SemanticPaletteInput } from '../src/index.ts';
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

  it('keeps all preset ids unique and provides the four motion choices', () => {
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
  });

  it('clamps the global density and preserves a minimum 24 by 24 target', () => {
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
  });

  it('resolves density, radius, elevation, type, font and motion selections', () => {
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
  });

  it('applies reduced motion over a selected motion preset and preserves omitted fields', () => {
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
  });

  it('rejects unknown preset ids with useful known ids', () => {
    expect(() => stylePresetInput({ density: 'roomy' as never })).toThrow(
      /Known presets: compact, default/
    );
    expect(() => stylePresetInput({ font: 'comic' })).toThrow(/Unknown font preset/);
    expect(() => stylePresetInput({ typeScale: 'huge' as never })).toThrow(
      /Unknown type scale preset/
    );
  });

  it('uses local system font stacks and only loads same-origin woff2 assets explicitly', async () => {
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
    await expect(loadVariableFont({ family: 'Bad', src: './font.woff' }, target)).rejects.toThrow(
      /same-origin/
    );
  });
});
