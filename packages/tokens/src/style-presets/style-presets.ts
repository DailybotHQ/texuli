import { defineTheme, type Theme, type ThemeInput } from '../contract/index.ts';
import { FONT_CATALOG, getFontPairing } from './fonts.ts';
import {
  DENSITY_PRESETS,
  ELEVATION_PRESETS,
  findPreset,
  MOTION_PRESETS,
  RADIUS_PRESETS,
  REDUCED_MOTION,
  type StylePresetInput,
  type StylePresetSelection,
  TYPE_SCALE_PRESETS,
} from './presets.ts';

/** Descriptive font choices, kept separate from their system-first font stacks. */
export const FONT_PRESETS = FONT_CATALOG.map(({ id, label }) => ({
  id,
  label,
  description: `${label} font pairing.`,
}));

/** Resolve selected presets into fields understood by the theme contract. */
export function stylePresetInput(selection: StylePresetSelection): StylePresetInput {
  const input: StylePresetInput = { style: {} };
  if (selection.density !== undefined) {
    input.density = findPreset(DENSITY_PRESETS, selection.density, 'density').density;
  }
  if (selection.radius !== undefined) {
    const radius = findPreset(RADIUS_PRESETS, selection.radius, 'radius');
    input.radius = radius.radius;
    input.style.shape = { radiusScale: radius.radiusScale };
  }
  if (selection.elevation !== undefined) {
    input.style.elevation = findPreset(ELEVATION_PRESETS, selection.elevation, 'elevation').id;
  }
  if (selection.font !== undefined) {
    findPreset(FONT_PRESETS, selection.font, 'font');
    const font = getFontPairing(selection.font);
    if (font) {
      input.fontFamily = font.fontFamily;
      input.fontFamilyHeading = font.fontFamilyHeading;
      input.fontFamilyMono = font.fontFamilyMono;
    }
  }
  if (selection.motion !== undefined) {
    const preset = findPreset(MOTION_PRESETS, selection.motion, 'motion');
    input.style.motion = { durations: { ...preset.durations }, easing: preset.easing };
  }
  if (selection.typeScale !== undefined) {
    const preset = findPreset(TYPE_SCALE_PRESETS, selection.typeScale, 'type scale');
    input.style.typography = { scaleRatio: preset.scaleRatio };
  }
  if (selection.reducedMotion) input.style.motion = structuredClone(REDUCED_MOTION);
  return input;
}

/** Apply selected values while preserving every theme field the selection omits. */
export function applyStylePresets(theme: ThemeInput, selection: StylePresetSelection): Theme {
  const { style, ...fields } = stylePresetInput(selection);
  const currentStyle = theme.style ?? {};
  return defineTheme({
    ...theme,
    ...fields,
    style: {
      ...currentStyle,
      ...style,
      ...(style.shape ? { shape: { ...currentStyle.shape, ...style.shape } } : {}),
      ...(style.typography
        ? { typography: { ...currentStyle.typography, ...style.typography } }
        : {}),
      ...(style.motion ? { motion: { ...currentStyle.motion, ...style.motion } } : {}),
    },
  });
}

export type { StylePreset, StylePresetInput, StylePresetSelection } from './presets.ts';
