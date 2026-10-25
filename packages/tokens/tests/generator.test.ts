import { describe, expect, it } from 'vitest';
import {
  checkPaletteContrast,
  checkThemeContrast,
  defineTheme,
  deriveChartTokens,
  dominantColors,
  generateThemeFromImage,
  generateThemeFromMood,
  generateThemeFromSeed,
  INTERACTIVE_SEMANTIC_ROLES,
  MOODS,
  moodSeed,
  NEUTRAL_FAMILIES,
  oklchToHex,
  parseHex,
  readImagePixels,
  rgbToOklch,
  SEMANTIC_ROLES,
  seedsFromColors,
  THEME_CONTRAST_PAIRS,
  type Theme,
  validateChartTokens,
  validateTheme,
} from '../src/index.ts';

const oklch = (color: string) => rgbToOklch(parseHex(color) as [number, number, number]);
const hueDistance = (a: number, b: number) => {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
};

/** The chart palette view of a generated theme, for `validateChartTokens`. */
function chartView(theme: Theme, mode: 'light' | 'dark') {
  const palette = theme[mode];
  const categorical = theme.charts?.[mode].categorical ?? [];
  return {
    surface: palette.surface.default,
    background: palette.background.default,
    destructive: palette.destructive.default,
    border: palette.border.default,
    mutedForeground: palette.mutedForeground.default,
    chart1: categorical[0] ?? '',
    chart2: categorical[1] ?? '',
    chart3: categorical[2] ?? '',
    chart4: categorical[3] ?? '',
    chart5: categorical[4] ?? '',
  };
}

describe('generateThemeFromSeed', () => {
  it('returns a complete, valid theme with every role in both modes', () => {
    const theme = generateThemeFromSeed({ seed: '#2b6ce0' });
    expect(validateTheme(theme).ok).toBe(true);
    for (const mode of ['light', 'dark'] as const) {
      expect(Object.keys(theme[mode]).sort()).toEqual([...SEMANTIC_ROLES].sort());
      for (const role of INTERACTIVE_SEMANTIC_ROLES) {
        const value = theme[mode][role];
        expect(value.hover, `${mode} ${role} hover`).toBeDefined();
        expect(value.active, `${mode} ${role} active`).toBeDefined();
        expect(value.disabled, `${mode} ${role} disabled`).toBeDefined();
        expect(value.focus).toBe(theme[mode].ring.default);
        expect(value.hover).not.toBe(value.default);
      }
    }
    // Built directly, yet exactly what the theme contract's validator produces.
    expect(defineTheme(theme)).toEqual(theme);
    expect(
      defineTheme(generateThemeFromSeed({ seed: '#2b6ce0', deriveCharts: deriveChartTokens }))
    ).toEqual(generateThemeFromSeed({ seed: '#2b6ce0', deriveCharts: deriveChartTokens }));
    expect(theme.id).toBe('generated-2b6ce0');
    expect(theme.name).toBe('Generated 2b6ce0');
  });

  it('is deterministic', () => {
    expect(generateThemeFromSeed({ seed: '#e11d48', neutral: 'warm' })).toEqual(
      generateThemeFromSeed({ seed: '#e11d48', neutral: 'warm' })
    );
  });

  it('keeps a usable brand color as the primary fill', () => {
    const theme = generateThemeFromSeed({ seed: '#2b6ce0' });
    // Dual-safe solid+outline may nudge lightness slightly; hue stays brand-blue.
    const lightPrimary = theme.light.primary.default;
    const darkPrimary = theme.dark.primary.default;
    expect(lightPrimary.startsWith('#')).toBe(true);
    expect(darkPrimary.startsWith('#')).toBe(true);
    expect(theme.light.primaryForeground.default).toBe('#ffffff');
    // Still recognizable blue family (not desaturated gray).
    expect(lightPrimary.toLowerCase()).not.toBe('#000000');
    expect(lightPrimary.toLowerCase()).not.toBe('#ffffff');
  });

  it('passes AA (and AAA on request) for any seed, neutral family and mode', () => {
    const seeds = ['#000000', '#ffffff', '#ffff00', '#00ffff', '#808080', '#f8f8f8'];
    for (let h = 0; h < 360; h += 40) {
      for (const l of [0.3, 0.6, 0.9]) seeds.push(oklchToHex({ l, c: 0.2, h }));
    }
    for (const seed of seeds) {
      for (const neutral of NEUTRAL_FAMILIES) {
        const aa = generateThemeFromSeed({ seed, neutral });
        expect(checkThemeContrast(aa), `${seed} ${neutral}`).toEqual([]);
      }
      const aaa = generateThemeFromSeed({ seed, contrast: 'AAA' });
      expect(checkThemeContrast(aaa, { textMinimum: 7 }), `${seed} AAA`).toEqual([]);
    }
  });

  it('keeps hover and active fills readable with their text', () => {
    const theme = generateThemeFromSeed({ seed: '#16a34a' });
    for (const mode of ['light', 'dark'] as const) {
      const issues = checkPaletteContrast(theme[mode]);
      expect(issues).toEqual([]);
    }
    // The pair list covers the interaction states of every filled role.
    expect(THEME_CONTRAST_PAIRS.filter((pair) => pair.states).length).toBeGreaterThanOrEqual(8);
  });

  it('keeps a gray seed gray and uses a second color for secondary fills', () => {
    const gray = generateThemeFromSeed({ seed: '#333333' });
    expect(oklch(gray.light.primary.default).c).toBeLessThan(0.04);
    const two = generateThemeFromSeed({ seed: '#2b6ce0', secondary: '#e11d48' });
    expect(hueDistance(oklch(two.light.secondary.default).h, oklch('#e11d48').h)).toBeLessThan(20);
    expect(two.description).toContain('#e11d48');
  });

  it('embeds chart tokens that pass the chart rules when given the chart engine', () => {
    const theme = generateThemeFromSeed({
      seed: '#facc15',
      neutral: 'stone',
      deriveCharts: deriveChartTokens,
    });
    expect(generateThemeFromSeed({ seed: '#facc15' }).charts).toBeUndefined();
    for (const mode of ['light', 'dark'] as const) {
      expect(
        validateChartTokens(theme.charts?.[mode] as never, chartView(theme, mode), mode)
      ).toEqual([]);
    }
  });

  it('applies identity, shape and spacing options', () => {
    const theme = generateThemeFromSeed({
      seed: '#2b6ce0',
      id: 'billing',
      name: 'Billing',
      radius: '0.25rem',
      density: 0.875,
    });
    expect(theme).toMatchObject({
      id: 'billing',
      name: 'Billing',
      radius: '0.25rem',
      density: 0.875,
    });
  });

  it('rejects bad seeds and unknown neutral families', () => {
    expect(() => generateThemeFromSeed({ seed: 'blue' })).toThrow(TypeError);
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', secondary: '#12' })).toThrow(TypeError);
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', neutral: 'neon' as never })).toThrow(
      /Unknown neutral family/
    );
    // Caller fields follow the theme contract's rules.
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', id: 'Bad Id' })).toThrow(/kebab/);
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', name: '' })).toThrow(/name/);
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', radius: '1rem;}' })).toThrow(
      /CSS length/
    );
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', density: 2 })).toThrow(/density/);
    expect(() => generateThemeFromSeed({ seed: '#2b6ce0', description: 'x'.repeat(201) })).toThrow(
      /description/
    );
  });
});

describe('contrast checks', () => {
  it('reports a pair that misses its minimum, and skips non-hex colors', () => {
    const theme = generateThemeFromSeed({ seed: '#2b6ce0' });
    const broken = {
      ...theme.light,
      primaryForeground: { default: theme.light.primary.default },
      overlay: { default: 'rgb(0 0 0 / 0.5)' },
    };
    const issues = checkPaletteContrast(broken);
    expect(
      issues.map((issue) => `${issue.foreground}/${issue.background}/${issue.state}`)
    ).toContain('primaryForeground/primary/default');
    expect(issues.every((issue) => issue.ratio < issue.required)).toBe(true);
  });
});

/** RGBA pixels: `[r, g, b, a, count]` runs, in order. */
function pixels(runs: [number, number, number, number, number][]) {
  const data: number[] = [];
  for (const [r, g, b, a, count] of runs) {
    for (let i = 0; i < count; i++) data.push(r, g, b, a);
  }
  return { data: Uint8ClampedArray.from(data) };
}

describe('dominant colors from an image', () => {
  const photo = pixels([
    [250, 250, 250, 255, 700],
    [30, 90, 210, 255, 200],
    [220, 40, 50, 255, 100],
    [0, 255, 0, 0, 500], // transparent: ignored
  ]);

  it('returns the most common opaque colors with their share', () => {
    const colors = dominantColors(photo);
    expect(colors).toHaveLength(3);
    expect(colors.map((color) => Math.round(color.weight * 100))).toEqual([70, 20, 10]);
    expect(colors[0]?.color).toBe('#fafafa');
    expect(colors[0]?.chroma).toBeLessThan(0.01);
    expect(dominantColors(photo)).toEqual(colors);
    expect(dominantColors(photo, { count: 1 })).toHaveLength(1);
  });

  it('merges near shades into one color and samples large images evenly', () => {
    const shades = pixels([
      [30, 90, 210, 255, 50],
      [34, 94, 214, 255, 50],
    ]);
    expect(dominantColors(shades)).toHaveLength(1);
    expect(dominantColors(photo, { maxSamples: 100 })[0]?.weight).toBeCloseTo(0.7, 1);
  });

  it('seeds a theme from the real colors, not the white background', () => {
    const seeds = seedsFromColors(dominantColors(photo));
    expect(hueDistance(oklch(seeds.seed).h, oklch('#1e5ad2').h)).toBeLessThan(10);
    expect(
      seeds.secondary && hueDistance(oklch(seeds.secondary).h, oklch('#dc2832').h)
    ).toBeLessThan(10);
    const theme = generateThemeFromImage(photo, { id: 'photo' });
    expect(theme.id).toBe('photo');
    expect(checkThemeContrast(theme)).toEqual([]);
    expect(hueDistance(oklch(theme.light.primary.default).h, oklch(seeds.seed).h)).toBeLessThan(10);
  });

  it('keeps a gray image gray and rejects an empty one', () => {
    const gray = pixels([
      [120, 120, 120, 255, 10],
      [30, 30, 30, 255, 5],
    ]);
    expect(seedsFromColors(dominantColors(gray))).toEqual({ seed: dominantColors(gray)[0]?.color });
    expect(() => generateThemeFromImage(pixels([[0, 0, 0, 0, 10]]))).toThrow(/no opaque pixels/);
  });

  it('reads pixels through a canvas, scaled down, and explains failures', () => {
    const imageData = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData;
    const drawn: number[][] = [];
    let canvasSize: number[] = [];
    const fakeDocument = (context: unknown) =>
      ({
        createElement: () => ({
          set width(value: number) {
            canvasSize[0] = value;
          },
          get width() {
            return canvasSize[0] ?? 0;
          },
          set height(value: number) {
            canvasSize[1] = value;
          },
          get height() {
            return canvasSize[1] ?? 0;
          },
          getContext: () => context,
        }),
      }) as never as Document;
    const context = {
      drawImage: (_image: unknown, ...args: number[]) => drawn.push(args),
      getImageData: () => imageData,
    };
    const image = { naturalWidth: 400, naturalHeight: 200, width: 400, height: 200 } as never;
    expect(readImagePixels(image, fakeDocument(context), 96)).toBe(imageData);
    expect(drawn[0]).toEqual([0, 0, 96, 48]);
    canvasSize = [];
    expect(() => readImagePixels(image, fakeDocument(null))).toThrow(/no 2D canvas/);
    const tainted = {
      drawImage: () => {},
      getImageData: () => {
        throw new DOMException('tainted', 'SecurityError');
      },
    };
    expect(() => readImagePixels(image, fakeDocument(tainted))).toThrow(/cross-origin/);
    expect(() =>
      readImagePixels({ naturalWidth: 0, width: 0, height: 0 } as never, fakeDocument(context))
    ).toThrow(/no size yet/);
  });
});

describe('themes from mood words', () => {
  it('maps known words to a seed, neutral family, radius and density', () => {
    const calm = moodSeed('Calm, ocean!');
    expect(calm.matched).toEqual(['calm', 'ocean']);
    expect(calm.neutral).toBe('cool');
    expect(hueDistance(oklch(calm.seed).h, 200)).toBeLessThan(25);
    const playful = moodSeed(['playful', 'warm']);
    expect(playful).toMatchObject({ neutral: 'warm', radius: '1rem' });
    expect(moodSeed('compact').density).toBe(0.875);
  });

  it('blends hues around the wheel and stays deterministic', () => {
    // Red (0°) and violet (290°) average across 0°, not through green.
    const blend = moodSeed('romantic creative');
    const hue = oklch(blend.seed).h;
    expect(hue > 300 || hue < 20).toBe(true);
    expect(moodSeed('romantic creative')).toEqual(blend);
  });

  it('gives unknown words a stable seed', () => {
    const first = moodSeed('zorblax quux');
    expect(first.matched).toEqual([]);
    expect(moodSeed('zorblax quux')).toEqual(first);
    expect(moodSeed('another phrase').seed).not.toBe(first.seed);
  });

  it('generates an accessible theme, with explicit options winning', () => {
    const theme = generateThemeFromMood('serious corporate compact', { id: 'corp' });
    expect(theme).toMatchObject({ id: 'corp', density: 0.875, radius: '0.375rem' });
    expect(theme.description).toContain('serious corporate compact');
    expect(checkThemeContrast(theme)).toEqual([]);
    expect(generateThemeFromMood('calm', { neutral: 'stone' })).toEqual(
      generateThemeFromSeed({
        seed: moodSeed('calm').seed,
        neutral: 'stone',
        description: 'Generated from the mood "calm".',
      })
    );
    for (const word of Object.keys(MOODS)) {
      expect(checkThemeContrast(generateThemeFromMood(word)), word).toEqual([]);
    }
  });
});
