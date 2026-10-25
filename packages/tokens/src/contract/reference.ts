/**
 * Tier 1 — reference OKLCH scales. Full 11-step scales generated from fixed
 * seeds through the palette engine (deterministic, gamut-mapped).
 */

import { generatePaletteScale, PALETTE_STEPS, type PaletteScale } from '../palette/scale.ts';

export type { PaletteScale };
export { PALETTE_STEPS };

/** Named reference scales available to generators and themes. */
export const REFERENCE_SCALE_IDS = [
  'neutral',
  'stone',
  'slate',
  'gray',
  'zinc',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
] as const;

export type ReferenceScaleId = (typeof REFERENCE_SCALE_IDS)[number];

/**
 * Seed hex for each reference scale. Seeds are the mid (500-ish) brand of the
 * family so `generatePaletteScale` rebuilds a full 11-step OKLCH ramp.
 */
export const REFERENCE_SCALE_SEEDS: Readonly<Record<ReferenceScaleId, string>> = {
  neutral: '#737373',
  stone: '#78716c',
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
};

/** Build one reference scale from its seed. */
export function getReferenceScale(id: ReferenceScaleId): PaletteScale {
  return generatePaletteScale(REFERENCE_SCALE_SEEDS[id]);
}

/** Build every reference scale (deterministic map). */
export function getAllReferenceScales(): Record<ReferenceScaleId, PaletteScale> {
  const out = {} as Record<ReferenceScaleId, PaletteScale>;
  for (const id of REFERENCE_SCALE_IDS) {
    out[id] = getReferenceScale(id);
  }
  return out;
}

export function isReferenceScaleId(value: string): value is ReferenceScaleId {
  return (REFERENCE_SCALE_IDS as readonly string[]).includes(value);
}
