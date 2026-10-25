/**
 * Build-time payload for the color / token explorer.
 * OKLCH scales, semantic roles, contrast pairs and export maps — no runtime fetch.
 */

import type { SemanticPalette, SemanticRole, Theme } from '@texuli/tokens';
import {
  AA_TEXT_MINIMUM,
  AA_UI_MINIMUM,
  type AaContrastLevel,
  contrastPairId,
  contrastRatio,
  generatePaletteScale,
  type PaletteScale,
  SEMANTIC_ROLES,
  TAILWIND_SEMANTIC_COLORS,
  type TailwindThemeEntry,
  THEME_CONTRAST_PAIRS,
  themeVariables,
} from '@texuli/tokens';
import type { LibraryThemeMeta } from '@texuli/tokens/library';
import { getFullThemeLibraryMeta, loadAllFullLibraryThemes } from '@texuli/tokens/library-expand';

export type ExplorerMode = 'light' | 'dark';

export interface ExplorerRoleSwatch {
  role: SemanticRole;
  default: string;
  hover?: string;
  active?: string;
}

export interface ExplorerContrastRow {
  id: string;
  kind: 'text' | 'ui';
  foreground: SemanticRole;
  background: SemanticRole;
  fg: string;
  bg: string;
  ratio: number;
  minimum: number;
  pass: boolean;
}

export interface ExplorerModePayload {
  mode: ExplorerMode;
  roles: readonly ExplorerRoleSwatch[];
  pairs: readonly ExplorerContrastRow[];
  /** 11-step OKLCH scales from primary / accent / secondary seeds. */
  scales: {
    primary: PaletteScale;
    accent: PaletteScale;
    secondary: PaletteScale;
  };
  /** Flattened CSS custom properties for this mode. */
  cssVars: Readonly<Record<string, string>>;
}

export interface ExplorerThemePayload {
  id: string;
  name: string;
  description: string;
  category: string;
  contrastLevel: AaContrastLevel;
  light: ExplorerModePayload;
  dark: ExplorerModePayload;
}

function roleColor(
  palette: SemanticPalette,
  role: SemanticRole,
  state: 'default' | 'hover' | 'active' = 'default'
): string {
  const value = palette[role];
  if (!value) return '#000000';
  if (state === 'default') return value.default;
  return value[state] ?? value.default;
}

function buildRoles(palette: SemanticPalette): ExplorerRoleSwatch[] {
  return SEMANTIC_ROLES.map((role) => {
    const value = palette[role];
    const entry: ExplorerRoleSwatch = {
      role,
      default: value?.default ?? '#000000',
    };
    if (value?.hover) entry.hover = value.hover;
    if (value?.active) entry.active = value.active;
    return entry;
  });
}

function buildPairs(palette: SemanticPalette, level: AaContrastLevel): ExplorerContrastRow[] {
  const textMin = level === 'AAA' ? 7 : AA_TEXT_MINIMUM;
  return THEME_CONTRAST_PAIRS.map((pair) => {
    const fg = roleColor(palette, pair.foreground);
    const bg = roleColor(palette, pair.background);
    const ratio = contrastRatio(fg, bg);
    const minimum = pair.kind === 'text' ? textMin : AA_UI_MINIMUM;
    return {
      id: contrastPairId(pair),
      kind: pair.kind,
      foreground: pair.foreground,
      background: pair.background,
      fg,
      bg,
      ratio: Math.round(ratio * 100) / 100,
      minimum,
      pass: ratio >= minimum - 1e-9,
    };
  });
}

function safeScale(seed: string): PaletteScale {
  try {
    return generatePaletteScale(seed);
  } catch {
    return generatePaletteScale('#64748b');
  }
}

function buildMode(theme: Theme, mode: ExplorerMode, level: AaContrastLevel): ExplorerModePayload {
  const palette = mode === 'dark' ? theme.dark : theme.light;
  const vars = themeVariables({ theme, mode });
  return {
    mode,
    roles: buildRoles(palette),
    pairs: buildPairs(palette, level),
    scales: {
      primary: safeScale(palette.primary.default),
      accent: safeScale(palette.accent.default),
      secondary: safeScale(palette.secondary.default),
    },
    cssVars: vars,
  };
}

/**
 * Full explorer dataset for every library theme (compact per-mode payload).
 */
export async function buildColorExplorerThemes(): Promise<readonly ExplorerThemePayload[]> {
  const [metaList, themes] = await Promise.all([
    getFullThemeLibraryMeta(),
    loadAllFullLibraryThemes(),
  ]);
  const metaMap = new Map(metaList.map((m: LibraryThemeMeta) => [m.id, m]));
  const order = new Map(metaList.map((m, i) => [m.id, i]));

  const out: ExplorerThemePayload[] = [];
  for (const theme of themes as readonly Theme[]) {
    const meta = metaMap.get(theme.id);
    const contrastLevel: AaContrastLevel = meta?.contrastLevel === 'AAA' ? 'AAA' : 'AA';
    out.push({
      id: theme.id,
      name: theme.name,
      description: theme.description ?? meta?.description ?? '',
      category: meta?.category ?? 'library',
      contrastLevel,
      light: buildMode(theme, 'light', contrastLevel),
      dark: buildMode(theme, 'dark', contrastLevel),
    });
  }

  out.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  return out;
}

/** Tailwind theme entries for the export panel (static, theme-independent). */
export function explorerTailwindEntries(): readonly TailwindThemeEntry[] {
  return TAILWIND_SEMANTIC_COLORS;
}

export { formatRatio } from './format.ts';
