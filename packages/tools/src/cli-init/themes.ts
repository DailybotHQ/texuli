/**
 * The theme side of the CLI: the full Texuli theme library (210 themes),
 * compiled CSS, a token preview and the WCAG 2.x AA report. Offline: every
 * theme ships inside `@texuli/tokens`.
 */

import { compileThemeCss, themeVariables } from '@texuli/tokens';
import { runAaGateOnTheme } from '@texuli/tokens/aa-gate';
import {
  getFullThemeMeta,
  listFullThemeLibrary,
  loadFullLibraryTheme,
  searchFullThemeLibrary,
} from '@texuli/tokens/library-expand';

export interface ThemeSummary {
  id: string;
  name: string;
  collection: string;
  contrastLevel: string;
  darkFirst: boolean;
  description: string;
}

export interface ThemePreview extends ThemeSummary {
  mode: 'light' | 'dark';
  /** Key tokens for the mode, by custom property name. */
  tokens: Record<string, string>;
  /** WCAG 2.x AA gate (both modes). */
  aa: { pass: boolean; issues: number; modes: { mode: string; pass: boolean; issues: number }[] };
}

/** The tokens a preview shows. */
export const PREVIEW_TOKENS = [
  '--tx-background',
  '--tx-foreground',
  '--tx-primary',
  '--tx-primary-foreground',
  '--tx-secondary',
  '--tx-accent',
  '--tx-muted',
  '--tx-muted-foreground',
  '--tx-border',
  '--tx-ring',
  '--tx-destructive',
  '--tx-success',
  '--tx-warning',
  '--tx-radius',
  '--tx-font-sans',
] as const;

function summary(meta: {
  id: string;
  name: string;
  collection: string;
  contrastLevel: string;
  darkFirst: boolean;
  description: string;
}): ThemeSummary {
  return {
    id: meta.id,
    name: meta.name,
    collection: meta.collection,
    contrastLevel: meta.contrastLevel,
    darkFirst: meta.darkFirst,
    description: meta.description,
  };
}

/** Every theme, or those matching `search` (all words must match). */
export async function listThemes(search?: string): Promise<ThemeSummary[]> {
  const metas = search?.trim()
    ? await searchFullThemeLibrary(search)
    : await listFullThemeLibrary();
  return metas.map(summary);
}

export async function themeExists(id: string): Promise<boolean> {
  return (await getFullThemeMeta(id)) !== undefined;
}

/** Compiled CSS for a theme (light and dark rules). */
export async function themeCss(id: string): Promise<string> {
  return compileThemeCss(await loadFullLibraryTheme(id));
}

/** Key tokens and the AA report for one theme in one mode. */
export async function previewTheme(
  id: string,
  mode: 'light' | 'dark'
): Promise<ThemePreview | null> {
  const meta = await getFullThemeMeta(id);
  if (!meta) return null;
  const theme = await loadFullLibraryTheme(id);
  const vars = themeVariables({ theme, mode });
  const tokens: Record<string, string> = {};
  for (const name of PREVIEW_TOKENS) if (vars[name] !== undefined) tokens[name] = vars[name];
  const report = runAaGateOnTheme({
    id,
    name: meta.name,
    contrastLevel: meta.contrastLevel === 'AAA' ? 'AAA' : 'AA',
    light: theme.light,
    dark: theme.dark,
  });
  return {
    ...summary(meta),
    mode,
    tokens,
    aa: {
      pass: report.pass,
      issues: report.issueCount,
      modes: report.modes.map((entry) => ({
        mode: entry.mode,
        pass: entry.pass,
        issues: entry.issueCount,
      })),
    },
  };
}
