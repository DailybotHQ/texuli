/**
 * Build-time theme gallery payload: catalog rows, AA scores, palette swatches.
 * Runs only during Astro SSR/build — never fetches at runtime.
 */

import type { SemanticPalette, Theme } from '@texuli/tokens';
import { type AaContrastLevel, runAaGateOnTheme } from '@texuli/tokens/aa-gate';
import type { LibraryThemeMeta } from '@texuli/tokens/library';
import { getFullThemeLibraryMeta, loadAllFullLibraryThemes } from '@texuli/tokens/library-expand';
import { createHighContrastPalette } from '@texuli/tokens/modes';
import { type GalleryModeScore, type GalleryPreviewMode, summarizeThemeScores } from './scores.ts';

/** Key colors shown as swatches on each card. */
export interface GalleryPaletteSwatch {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  muted: string;
  border: string;
}

export interface GalleryThemeCard {
  id: string;
  name: string;
  description: string;
  category: string;
  collection: string;
  tags: readonly string[];
  darkFirst: boolean;
  contrastLevel: AaContrastLevel;
  /** Overall AA pass across light and dark (HC often skipped as non-hex). */
  pass: boolean;
  issueCount: number;
  scores: readonly GalleryModeScore[];
  swatches: Record<GalleryPreviewMode, GalleryPaletteSwatch>;
}

function swatchFromPalette(palette: SemanticPalette): GalleryPaletteSwatch {
  return {
    background: palette.background.default,
    foreground: palette.foreground.default,
    primary: palette.primary.default,
    primaryForeground: palette.primaryForeground.default,
    accent: palette.accent.default,
    muted: palette.muted.default,
    border: palette.border.default,
  };
}

function metaById(meta: readonly LibraryThemeMeta[]): Map<string, LibraryThemeMeta> {
  return new Map(meta.map((entry) => [entry.id, entry]));
}

/**
 * Build every gallery card for the full library (port + expand ≈ 210 themes).
 * Contrast math runs once at build; the page ships only compact summaries.
 */
export async function buildGalleryThemeCards(): Promise<readonly GalleryThemeCard[]> {
  const [metaList, themes] = await Promise.all([
    getFullThemeLibraryMeta(),
    loadAllFullLibraryThemes(),
  ]);
  const metaMap = metaById(metaList);
  const highContrast = createHighContrastPalette();
  const hcSwatch = swatchFromPalette(highContrast);

  const cards: GalleryThemeCard[] = [];
  for (const theme of themes as readonly Theme[]) {
    const meta = metaMap.get(theme.id);
    const contrastLevel: AaContrastLevel = meta?.contrastLevel === 'AAA' ? 'AAA' : 'AA';
    const report = runAaGateOnTheme({
      id: theme.id,
      name: theme.name,
      contrastLevel,
      light: theme.light,
      dark: theme.dark,
      highContrast,
    });
    // Overall pass focuses on authored light/dark (HC is mostly non-hex skips).
    const authored = report.modes.filter((m) => m.mode === 'light' || m.mode === 'dark');
    const pass = authored.every((m) => m.pass);
    const issueCount = authored.reduce((sum, m) => sum + m.issueCount, 0);

    cards.push({
      id: theme.id,
      name: theme.name,
      description: theme.description ?? meta?.description ?? '',
      category: meta?.category ?? 'library',
      collection: meta?.collection ?? 'industry',
      tags: meta?.tags ?? [],
      darkFirst: meta?.darkFirst ?? false,
      contrastLevel,
      pass,
      issueCount,
      scores: summarizeThemeScores(report),
      swatches: {
        light: swatchFromPalette(theme.light),
        dark: swatchFromPalette(theme.dark),
        'high-contrast': hcSwatch,
      },
    });
  }

  // Stable order: catalog meta order when known, else id.
  const order = new Map(metaList.map((m, i) => [m.id, i]));
  cards.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  return cards;
}
