/**
 * Build-time helpers for the site theme switcher: full library metadata and
 * compact multi-theme CSS. Used only at Astro build / SSR time — never fetched
 * at runtime.
 */
import { defineTheme, themeVariables } from '@texuli/tokens';
import { forcedColorsCssVariables } from '@texuli/tokens/forced-colors';
import type { LibraryThemeMeta } from '@texuli/tokens/library';
import { getFullThemeLibraryMeta, loadAllFullLibraryThemes } from '@texuli/tokens/library-expand';
import type { ThemeCatalogEntry } from './catalog.ts';

export { filterThemeCatalog, type ThemeCatalogEntry } from './catalog.ts';

/** Build the browse catalog (210 themes: port + expand) with each theme's own swatch hexes. */
export async function buildThemeCatalog(): Promise<readonly ThemeCatalogEntry[]> {
  const [meta, themes] = await Promise.all([getFullThemeLibraryMeta(), loadAllFullLibraryThemes()]);
  const byId = new Map(themes.map((theme) => [theme.id, theme]));
  return meta.map((entry: LibraryThemeMeta) => {
    const theme = byId.get(entry.id);
    const light = theme?.light;
    const dark = theme?.dark;
    return {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      collection: entry.collection,
      tags: entry.tags,
      swatches: {
        background: light?.background.default ?? entry.seed,
        foreground: light?.foreground.default ?? '#111827',
        primary: light?.primary.default ?? entry.seed,
        accent: light?.accent.default ?? light?.secondary.default ?? entry.seed,
        surface: light?.surface.default ?? light?.background.default ?? '#ffffff',
      },
      ...(dark
        ? {
            swatchesDark: {
              background: dark.background.default,
              foreground: dark.foreground.default,
              primary: dark.primary.default,
              accent: dark.accent?.default ?? dark.secondary.default,
              surface: dark.surface?.default ?? dark.background.default,
            },
          }
        : {}),
    };
  });
}

function declareBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

/**
 * Compact CSS for every library theme (light + dark). Scoped by
 * `data-tx-theme` + `data-tx-mode` so switching attributes swaps the palette
 * without a network round-trip.
 */
export async function buildThemeLibraryCss(): Promise<string> {
  const themes = await loadAllFullLibraryThemes();
  const rules: string[] = [];
  for (const input of themes) {
    const theme = defineTheme(input);
    for (const mode of ['light', 'dark'] as const) {
      const vars = themeVariables({ theme, mode });
      rules.push(`[data-tx-theme='${theme.id}'][data-tx-mode='${mode}']{${declareBlock(vars)}}`);
    }
  }
  return `@layer tx.base{${rules.join('')}}`;
}

/**
 * Explicit high-contrast mode rules (system colors). Complements light/dark
 * theme rules and `forced-colors.css` (which only activates under the OS media
 * query).
 */
export function buildHighContrastModeCss(): string {
  const vars = {
    ...forcedColorsCssVariables(),
    '--tx-border-width': '2px',
    '--tx-focus-ring-width': '3px',
    '--tx-focus-ring-offset': '2px',
    '--tx-focus-ring-style': 'solid',
  };
  return `@layer tx.base{[data-tx-mode='high-contrast']{${declareBlock(vars)}}}`;
}

/** Known `--tx-*` names for capturing computed vars into the no-flash cache. */
export function themeCssVariableNames(): readonly string[] {
  const sample = forcedColorsCssVariables();
  const chrome = [
    '--tx-radius',
    '--tx-font-sans',
    '--tx-font-heading',
    '--tx-font-mono',
    '--tx-density',
    '--tx-motion',
    '--tx-border-width',
    '--tx-focus-ring-width',
    '--tx-focus-ring-offset',
    '--tx-focus-ring-style',
    '--tx-shadow-soft',
    '--tx-shadow-float',
    '--tx-surface-style',
    '--tx-elevation-style',
    '--tx-glass-opacity',
    '--tx-glass-blur',
    '--tx-motion-fast',
    '--tx-motion-base',
    '--tx-motion-slow',
    '--tx-motion-easing',
    '--tx-chart-grid',
    '--tx-chart-axis',
  ];
  return Object.freeze([...new Set([...Object.keys(sample), ...chrome])].sort());
}
