import type { ElevationStyle, ThemeInput, ThemeStyle } from '../contract/types.ts';

export interface StylePreset<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly description: string;
}

export const DENSITY_MIN = 0.75;
export const DENSITY_MAX = 1.25;
export const MIN_TARGET_SIZE_PX = 24;
export const DEFAULT_TARGET_SIZE_PX = 44;

export const DENSITY_PRESETS = [
  {
    id: 'compact',
    label: 'Compact',
    description: 'Tighter spacing for dense interfaces.',
    density: 0.875,
  },
  {
    id: 'default',
    label: 'Default',
    description: 'Balanced spacing for everyday interfaces.',
    density: 1,
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    description: 'More breathing room between controls.',
    density: 1.125,
  },
  {
    id: 'spacious',
    label: 'Spacious',
    description: 'Airy spacing for touch-first interfaces.',
    density: 1.25,
  },
] as const satisfies readonly (StylePreset<string> & { density: number })[];
export type DensityPresetId = (typeof DENSITY_PRESETS)[number]['id'];

/** Density affects spacing and preferred target size; target size remains at least 24 px. */
export function densityScale(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, value));
}

/** Return a square control target after density scaling, never below WCAG 2.2's 24 px floor. */
export function densityTargetSize(
  density: number | undefined,
  preferredSize = DEFAULT_TARGET_SIZE_PX
): number {
  if (!Number.isFinite(preferredSize) || preferredSize < 0) {
    throw new RangeError('Preferred target size must be a finite non-negative number');
  }
  return Math.max(MIN_TARGET_SIZE_PX, preferredSize * densityScale(density));
}

export const RADIUS_PRESETS = [
  {
    id: 'square',
    label: 'Square',
    description: 'No rounding at any size.',
    radius: '0',
    radiusScale: 0,
  },
  {
    id: 'sharp',
    label: 'Sharp',
    description: 'Subtle corner rounding.',
    radius: '0.25rem',
    radiusScale: 0.5,
  },
  {
    id: 'default',
    label: 'Default',
    description: 'Balanced corner rounding.',
    radius: '0.625rem',
    radiusScale: 1,
  },
  {
    id: 'round',
    label: 'Round',
    description: 'Soft, generous corners.',
    radius: '1rem',
    radiusScale: 1.25,
  },
  {
    id: 'pill',
    label: 'Pill',
    description: 'Fully rounded controls.',
    radius: '9999px',
    radiusScale: 1,
  },
] as const satisfies readonly (StylePreset<string> & { radius: string; radiusScale: number })[];
export type RadiusPresetId = (typeof RADIUS_PRESETS)[number]['id'];

export const ELEVATION_PRESETS = [
  { id: 'flat', label: 'Flat', description: 'No shadow; rely on borders and contrast.' },
  { id: 'soft', label: 'Soft', description: 'Diffuse shadows for gentle separation.' },
  { id: 'crisp', label: 'Crisp', description: 'Short, defined shadows.' },
  { id: 'glow', label: 'Glow', description: 'A colored glow around elevated surfaces.' },
  { id: 'layered', label: 'Layered', description: 'Stacked shadows that communicate depth.' },
] as const satisfies readonly StylePreset<ElevationStyle>[];

export const MOTION_PRESETS = [
  {
    id: 'none',
    label: 'None',
    description: 'Disable transitions.',
    durations: { fast: 0, base: 0, slow: 0 },
    easing: 'linear',
  },
  {
    id: 'subtle',
    label: 'Subtle',
    description: 'Short, quiet transitions.',
    durations: { fast: 100, base: 150, slow: 200 },
    easing: 'ease-out',
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Balanced transitions.',
    durations: { fast: 150, base: 200, slow: 300 },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  {
    id: 'expressive',
    label: 'Expressive',
    description: 'Longer transitions with an overshoot.',
    durations: { fast: 200, base: 300, slow: 500 },
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
] as const satisfies readonly (StylePreset<string> & {
  durations: ThemeStyle['motion']['durations'];
  easing: string;
})[];
export type MotionPresetId = (typeof MOTION_PRESETS)[number]['id'];

export const REDUCED_MOTION = {
  durations: { fast: 0, base: 0, slow: 0 },
  easing: 'linear',
} as const satisfies ThemeStyle['motion'];

export const TYPE_SCALE_PRESETS = [
  { id: 'compact', label: 'Compact', description: 'A restrained type scale.', scaleRatio: 1.067 },
  { id: 'default', label: 'Default', description: 'A balanced type scale.', scaleRatio: 1.2 },
  {
    id: 'comfortable',
    label: 'Comfortable',
    description: 'A more expressive type scale.',
    scaleRatio: 1.25,
  },
  {
    id: 'display',
    label: 'Display',
    description: 'A pronounced scale for editorial and display layouts.',
    scaleRatio: 1.333,
  },
] as const satisfies readonly (StylePreset<string> & { scaleRatio: number })[];
export type TypeScalePresetId = (typeof TYPE_SCALE_PRESETS)[number]['id'];

export interface StylePresetSelection {
  density?: DensityPresetId;
  radius?: RadiusPresetId;
  elevation?: ElevationStyle;
  font?: string;
  motion?: MotionPresetId;
  typeScale?: TypeScalePresetId;
  reducedMotion?: boolean;
}

export type StylePresetInput = Pick<
  ThemeInput,
  'radius' | 'density' | 'fontFamily' | 'fontFamilyHeading' | 'fontFamilyMono'
> & { style: NonNullable<ThemeInput['style']> };

export function findPreset<T extends { id: string }>(
  presets: readonly T[],
  id: string,
  kind: string
): T {
  const preset = presets.find((entry) => entry.id === id);
  if (!preset) {
    throw new TypeError(
      `Unknown ${kind} preset "${id}". Known presets: ${presets.map((entry) => entry.id).join(', ')}`
    );
  }
  return preset;
}
