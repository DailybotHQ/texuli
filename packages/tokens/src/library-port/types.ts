import type { Theme, ThemeInput } from '../contract/types.ts';

export const THEME_COLLECTIONS = [
  'industry',
  'brand-like',
  'high-contrast',
  'colorblind-safe',
  'seasonal',
  'mono',
] as const;
export type ThemeCollection = (typeof THEME_COLLECTIONS)[number];

export const THEME_MOODS = [
  'calm',
  'bold',
  'playful',
  'corporate',
  'editorial',
  'technical',
  'warm',
  'fresh',
  'luxurious',
  'minimal',
] as const;
export type ThemeMood = (typeof THEME_MOODS)[number];

export const THEME_CONTRAST_LEVELS = ['AA', 'AAA'] as const;
export type ThemeContrastLevel = (typeof THEME_CONTRAST_LEVELS)[number];

export const THEME_NEUTRALS = ['zinc', 'slate', 'stone', 'gray', 'warm', 'cool', 'tinted'] as const;
export type ThemeNeutral = (typeof THEME_NEUTRALS)[number];

/** Small data record. Color tokens are generated when the corresponding lazy module is loaded. */
export interface LibraryThemeDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: readonly string[];
  collection?: ThemeCollection;
  mood?: readonly ThemeMood[];
  darkFirst?: boolean;
  contrastLevel?: ThemeContrastLevel;
  seed: string;
  secondary?: string;
  neutral?: ThemeNeutral;
  chartSeeds?: readonly string[];
  font?: string;
  radius?: string;
  density?: number;
  style?: ThemeInput['style'];
}

/** Fields needed by catalog browsers; no full theme or chart tokens are loaded here. */
export interface LibraryThemeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: readonly string[];
  collection: ThemeCollection;
  mood: readonly ThemeMood[];
  darkFirst: boolean;
  contrastLevel: ThemeContrastLevel;
  seed: string;
  secondary?: string;
  neutral?: ThemeNeutral;
}

export type LibraryThemeLoader = () => Promise<{ default: LibraryThemeDefinition }>;
export type LoadedLibraryTheme = Theme;
