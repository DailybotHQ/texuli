/**
 * Tailwind 4 preset for `@texuli/tokens`.
 *
 * CSS entry: `@import '@texuli/tokens/tailwind/preset.css'` (after `tailwindcss`).
 * The TypeScript map documents and tests every theme binding.
 */

export {
  renderThemeInlineBlock,
  TAILWIND_CHART_COLORS,
  TAILWIND_INTERACTION_COLORS,
  TAILWIND_RADIUS,
  TAILWIND_SEMANTIC_COLORS,
  TAILWIND_SPACING_MOTION_SHADOW,
  TAILWIND_SURFACE_ALIASES,
  TAILWIND_THEME_ENTRIES,
  TAILWIND_TYPOGRAPHY,
  type TailwindThemeEntry,
  themeEntryValue,
} from './theme-map.ts';

/** Package-relative path of the preset stylesheet (for docs and tooling). */
export const TAILWIND_PRESET_CSS = './preset.css' as const;

/** Subpath consumers import in CSS. */
export const TAILWIND_PRESET_PACKAGE_PATH = '@texuli/tokens/tailwind/preset.css' as const;

/** Utility class names the preset registers (logical CSS). */
export const TAILWIND_UTILITIES = [
  'pt-safe',
  'pb-safe',
  'ps-safe',
  'pe-safe',
  'px-safe',
  'py-safe',
  'h-app',
  'min-h-app',
  'max-h-app',
  'min-h-touch',
] as const;

export type TailwindUtilityName = (typeof TAILWIND_UTILITIES)[number];

/**
 * Resolve the absolute file URL of `preset.css` next to this module.
 * Does not touch `window` or `document`; safe at import time in Node and bundlers.
 */
export function tailwindPresetCssHref(metaUrl: string | URL = import.meta.url): string {
  return new URL('./preset.css', metaUrl).href;
}
