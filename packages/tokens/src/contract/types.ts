/**
 * Theme document an agent can emit: identity, fonts, density, dual-mode
 * semantic palettes, optional charts, style, and component hooks.
 */

import type { ComponentHooks } from './hooks.ts';
import type { SemanticPalette, SemanticPaletteInput } from './semantic.ts';

export type ColorModeName = 'light' | 'dark';

/** Chart series colors for one mode (hex data colors + chrome). */
export type ThemeChartTokens = {
  categorical: readonly [string, string, string, string, string, string, string, string];
  sequential: readonly [string, string, string, string, string, string, string, string, string];
  diverging: readonly [string, string, string, string, string, string, string, string, string];
  grid: string;
  axis: string;
};

export type ThemeCharts = {
  light: ThemeChartTokens;
  dark: ThemeChartTokens;
};

export type ElevationStyle = 'flat' | 'soft' | 'crisp' | 'glow' | 'layered';
export type SurfaceStyle = 'solid' | 'glass';
export type FocusRingStyle = 'ring' | 'outline' | 'glow' | 'inset';

export type ThemeTypography = {
  scaleRatio: number | null;
  weights: { body: number; medium: number; heading: number; bold: number };
  tracking: { body: string; heading: string };
};

export type ThemeShape = {
  radiusScale: number;
  borderWidth: string;
};

export type ThemeMotion = {
  durations: { fast: number; base: number; slow: number };
  easing: string;
};

export type ThemeFocusRing = {
  style: FocusRingStyle;
  width: string;
  offset: string;
};

export type ThemeStyle = {
  typography: ThemeTypography;
  shape: ThemeShape;
  elevation: ElevationStyle;
  surface: SurfaceStyle;
  motion: ThemeMotion;
  focusRing: ThemeFocusRing;
};

/** Validated theme document. */
export type Theme = {
  id: string;
  name: string;
  description: string;
  fontFamily: string;
  fontFamilyHeading?: string;
  fontFamilyMono: string;
  radius: string;
  density: number;
  light: SemanticPalette;
  dark: SemanticPalette;
  style: ThemeStyle;
  charts?: ThemeCharts;
  components?: ComponentHooks;
};

/** Agent / author input before validation. */
export type ThemeInput = {
  id: string;
  name: string;
  description?: string;
  fontFamily?: string;
  fontFamilyHeading?: string;
  fontFamilyMono?: string;
  radius?: string;
  density?: number;
  light: SemanticPaletteInput;
  dark: SemanticPaletteInput;
  style?: Partial<{
    typography?: Partial<ThemeTypography> & {
      weights?: Partial<ThemeTypography['weights']>;
      tracking?: Partial<ThemeTypography['tracking']>;
    };
    shape?: Partial<ThemeShape>;
    elevation?: ElevationStyle;
    surface?: SurfaceStyle;
    motion?: Partial<ThemeMotion> & {
      durations?: Partial<ThemeMotion['durations']>;
    };
    focusRing?: Partial<ThemeFocusRing>;
  }>;
  charts?: ThemeCharts;
  components?: ComponentHooks;
};

/** System-first defaults (no webfont names the package does not ship). */
export const DEFAULT_FONT_SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const DEFAULT_FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export const DEFAULT_RADIUS = '0.625rem';
export const DEFAULT_DENSITY = 1;

export const DEFAULT_THEME_STYLE: ThemeStyle = {
  typography: {
    scaleRatio: null,
    weights: { body: 400, medium: 500, heading: 600, bold: 700 },
    tracking: { body: '0', heading: '0' },
  },
  shape: { radiusScale: 1, borderWidth: '1px' },
  elevation: 'soft',
  surface: 'solid',
  motion: {
    durations: { fast: 150, base: 200, slow: 300 },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  focusRing: { style: 'ring', width: '2px', offset: '2px' },
};
