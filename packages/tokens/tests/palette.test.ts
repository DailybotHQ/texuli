import { describe, expect, it } from 'vitest';
import {
  CHART_CATEGORICAL_COUNT,
  CHART_RAMP_STEPS,
  type ChartPaletteInput,
  chartColorDistance,
  contrastRatio,
  deriveChartTokens,
  generatePaletteScale,
  MIN_CHART_CONTRAST,
  MIN_CHART_CVD_DISTANCE,
  MIN_CHART_DISTANCE,
  oklchToHex,
  PALETTE_STEPS,
  parseHex,
  relativeLuminance,
  rgbToOklch,
  validateChartTokens,
} from '../src/index.ts';

const hexes = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#123456'];

describe('OKLCH conversion', () => {
  it('round-trips sRGB primaries and neutral endpoints through gamut mapping', () => {
    for (const hex of hexes) {
      const rgb = parseHex(hex);
      expect(rgb).not.toBeNull();
      expect(oklchToHex(rgbToOklch(rgb as [number, number, number]))).toBe(hex);
    }
  });

  it('maps high-chroma colors into sRGB and rejects non-finite inputs', () => {
    expect(oklchToHex({ l: 0.62, c: 1, h: 285 })).toMatch(/^#[0-9a-f]{6}$/);
    expect(() => oklchToHex({ l: 0.5, c: Number.NaN, h: 0 })).toThrow(RangeError);
    expect(() => rgbToOklch([-1, 0, 0])).toThrow(RangeError);
  });
});

describe('WCAG contrast', () => {
  it('matches standard ratios and only accepts hexadecimal sRGB input', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5);
    expect(parseHex('rgb(0 0 0)')).toBeNull();
    expect(relativeLuminance('#000')).toBe(0);
    expect(() => contrastRatio('rebeccapurple', '#fff')).toThrow(TypeError);
  });
});

describe('palette scales', () => {
  it('returns deterministic complete 11-step scales from valid seeds', () => {
    const first = generatePaletteScale('#2b6ce0');
    expect(first).toEqual(generatePaletteScale('#2b6ce0'));
    expect(Object.keys(first).map(Number)).toEqual(PALETTE_STEPS);
    expect(Object.values(first).every((value) => parseHex(value) !== null)).toBe(true);
    const lightness = Object.values(first).map(
      (value) => rgbToOklch(parseHex(value) as [number, number, number]).l
    );
    expect(
      lightness.every((value, index) => index === 0 || value < (lightness[index - 1] as number))
    ).toBe(true);
  });

  it('rejects malformed seeds and preserves an achromatic seed as gray', () => {
    expect(() => generatePaletteScale('rebeccapurple')).toThrow(/#rgb or #rrggbb/);
    for (const color of Object.values(generatePaletteScale('#18181b'))) {
      expect(rgbToOklch(parseHex(color) as [number, number, number]).c).toBeLessThan(0.01);
    }
  });
});

const chartInput: ChartPaletteInput = {
  surface: '#ffffff',
  background: '#fafafa',
  destructive: '#c21725',
  border: '#e5e7eb',
  mutedForeground: '#4b5563',
  chart1: '#157971',
  chart2: '#2559e3',
  chart3: '#009068',
  chart4: '#a96b00',
  chart5: '#a853ad',
};

describe('chart palette derivation', () => {
  it('derives deterministic categorical, sequential and diverging tokens that pass validation', () => {
    const tokens = deriveChartTokens(chartInput, 'light');
    expect(tokens).toEqual(deriveChartTokens(chartInput, 'light'));
    expect(tokens.categorical).toHaveLength(CHART_CATEGORICAL_COUNT);
    expect(tokens.sequential).toHaveLength(CHART_RAMP_STEPS);
    expect(tokens.diverging).toHaveLength(CHART_RAMP_STEPS);
    expect(tokens.grid).toBe(chartInput.border);
    expect(tokens.axis).toBe(chartInput.mutedForeground);
    expect(validateChartTokens(tokens, chartInput, 'light')).toEqual([]);
  });

  it('keeps categorical colors apart in normal vision and color-vision simulations', () => {
    const darkPalette = { ...chartInput, surface: '#18181b', background: '#09090b' };
    const tokens = deriveChartTokens(darkPalette, 'dark');
    for (let index = 0; index < tokens.categorical.length; index += 1) {
      for (let earlier = 0; earlier < index; earlier += 1) {
        const a = tokens.categorical[index] as string;
        const b = tokens.categorical[earlier] as string;
        expect(chartColorDistance(a, b)).toBeGreaterThanOrEqual(MIN_CHART_DISTANCE);
        for (const vision of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
          expect(chartColorDistance(a, b, vision)).toBeGreaterThanOrEqual(MIN_CHART_CVD_DISTANCE);
        }
      }
    }
    for (const color of [
      ...tokens.categorical,
      tokens.sequential.at(-1),
      tokens.diverging[0],
      tokens.diverging.at(-1),
    ]) {
      expect(contrastRatio(color as string, darkPalette.surface)).toBeGreaterThanOrEqual(
        MIN_CHART_CONTRAST
      );
      expect(contrastRatio(color as string, darkPalette.background)).toBeGreaterThanOrEqual(
        MIN_CHART_CONTRAST
      );
    }
  });

  it('rejects palettes with no valid display surface', () => {
    expect(() =>
      deriveChartTokens({ ...chartInput, surface: 'red', background: 'blue' }, 'light')
    ).toThrow(/hex surface or background/);
  });

  it('keeps derived charts valid for a deterministic seed corpus in both modes', () => {
    const failures: string[] = [];
    for (let index = 0; index < 60; index += 1) {
      const seed = `#${((index * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0').slice(-6)}`;
      const scale = generatePaletteScale(seed);
      for (const mode of ['light', 'dark'] as const) {
        const dark = mode === 'dark';
        const input: ChartPaletteInput = {
          surface: dark ? '#18181b' : '#ffffff',
          background: dark ? '#09090b' : '#fafafa',
          destructive: dark ? '#f85452' : '#c21725',
          border: dark ? '#3f3f46' : '#e5e7eb',
          mutedForeground: dark ? '#a1a1aa' : '#4b5563',
          chart1: scale[600],
          chart2: scale[500],
          chart3: oklchToHex({ l: dark ? 0.72 : 0.58, c: 0.16, h: 165 }),
          chart4: oklchToHex({ l: dark ? 0.72 : 0.58, c: 0.16, h: 70 }),
          chart5: oklchToHex({ l: dark ? 0.72 : 0.58, c: 0.16, h: 325 }),
        };
        const tokens = deriveChartTokens(input, mode);
        const issues = validateChartTokens(tokens, input, mode);
        for (const issue of issues) failures.push(`${index}/${mode}: ${issue.kind}/${issue.list}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
