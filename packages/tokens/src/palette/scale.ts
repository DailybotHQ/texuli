import { parseHex } from './contrast.ts';
import { oklchToHex, rgbToOklch } from './oklch.ts';

export const PALETTE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type PaletteStep = (typeof PALETTE_STEPS)[number];
export type PaletteScale = Record<PaletteStep, string>;

const LIGHTNESS: readonly (readonly [PaletteStep, number])[] = [
  [50, 0.98],
  [100, 0.95],
  [200, 0.9],
  [300, 0.82],
  [400, 0.72],
  [500, 0.62],
  [600, 0.52],
  [700, 0.42],
  [800, 0.32],
  [900, 0.22],
  [950, 0.12],
];

/** Creates a deterministic, gamut-mapped 11-step scale from a #rgb or #rrggbb seed. */
export function generatePaletteScale(seed: string): PaletteScale {
  const rgb = parseHex(seed);
  if (!rgb) throw new TypeError(`Palette seed must be a #rgb or #rrggbb color, got "${seed}"`);
  const color = rgbToOklch(rgb);
  const chroma = Math.min(color.c, 0.24);
  return Object.fromEntries(
    LIGHTNESS.map(([step, lightness]) => [step, oklchToHex({ ...color, l: lightness, c: chroma })])
  ) as PaletteScale;
}
