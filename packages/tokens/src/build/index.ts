/**
 * Build one complete Theme from a compact library definition (seed, mood, …)
 * without loading the theme catalog. Consumers that only need a single theme
 * import `@texuli/tokens/build` instead of `@texuli/tokens/library`.
 */

export type { Theme } from '../contract/types.ts';
export { buildLibraryTheme } from '../library-port/build.ts';
export type {
  LibraryThemeDefinition,
  ThemeCollection,
  ThemeContrastLevel,
  ThemeMood,
  ThemeNeutral,
} from '../library-port/types.ts';
export {
  THEME_COLLECTIONS,
  THEME_CONTRAST_LEVELS,
  THEME_MOODS,
  THEME_NEUTRALS,
} from '../library-port/types.ts';
