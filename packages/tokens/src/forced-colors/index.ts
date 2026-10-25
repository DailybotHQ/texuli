/**
 * Forced colors and prefers-contrast for `@texuli/tokens`.
 * Every semantic role maps to a CSS system color; focus rings, borders and
 * selection stay visible when the OS replaces the theme palette.
 */

export { compileForcedColorsCss } from './compile.ts';
export {
  checkForcedColorsCoverage,
  createForcedColorsPalette,
  FORCED_COLORS_ROLE_MAP,
  FORCED_COLORS_VISIBILITY_ROLES,
  type ForcedColorsCoverageIssue,
  forcedColorsCssVariables,
  forcedColorsStateColor,
} from './mapping.ts';
export {
  isSystemColorKeyword,
  SYSTEM_COLOR_KEYWORDS,
  type SystemColorKeyword,
} from './system-colors.ts';
