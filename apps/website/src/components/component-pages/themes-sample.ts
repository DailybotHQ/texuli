/**
 * The "in your theme" strip on every component page (T-81, punch-list row 4).
 *
 * Three themes picked from the real 210-theme library — one saturated light,
 * one neutral light, one dark AAA — spread across the gamut the way the audit
 * rubric's theme-cohesion dimension asks. Token values come from the token
 * engine at build time (`themeVariables`), never hardcoded: if a theme id
 * disappears from the library the build fails loudly instead of shipping a
 * fake swatch. Static HTML only — no island, no extra requests; the build's
 * CSP pipeline hashes the per-card style attributes it generates.
 */

export interface StripTheme {
  id: string;
  name: string;
  /** Library category (builtin, curated, …) from the theme metadata. */
  category: string;
  /** The library's own contrast gate level for the theme (AA, AAA). */
  contrastLevel: string;
  /** Which mode's values the strip shows: dark-first themes show dark. */
  mode: 'light' | 'dark';
  /** The core surface variables the card overrides, `--tx-*` → value. */
  vars: Record<string, string>;
}

/**
 * Stable ids, verified against the library at build. The set holds a
 * saturated light theme, a neutral light theme and a dark AAA theme.
 */
export const STRIP_THEME_IDS: readonly [string, string, string] = [
  'violet',
  'monochrome',
  'accessible-dark-contrast',
];

/** The core `--tx-*` variables a strip card overrides. */
export const STRIP_VARS: readonly string[] = [
  '--tx-background',
  '--tx-foreground',
  '--tx-muted-foreground',
  '--tx-surface',
  '--tx-surface-foreground',
  '--tx-primary',
  '--tx-primary-foreground',
  '--tx-accent',
  '--tx-accent-foreground',
  '--tx-border',
  '--tx-border-strong',
  '--tx-ring',
  '--tx-radius',
];

async function library() {
  const { getFullThemeLibraryMeta, loadFullLibraryTheme } = await import(
    '@texuli/tokens/library-expand'
  );
  const { themeVariables } = await import('@texuli/tokens/css');
  return { getFullThemeLibraryMeta, loadFullLibraryTheme, themeVariables };
}

/**
 * The three strip themes with their real token values. Throws when a curated
 * id is missing from the library: a swatch that lies about the library is
 * worse than a failed build.
 */
export async function loadStripThemes(): Promise<readonly StripTheme[]> {
  const { getFullThemeLibraryMeta, loadFullLibraryTheme, themeVariables } = await library();
  const meta = await getFullThemeLibraryMeta();
  return Promise.all(
    STRIP_THEME_IDS.map(async (id): Promise<StripTheme> => {
      const entry = meta.find((theme) => theme.id === id);
      if (!entry) throw new Error(`theme strip id "${id}" is not in the theme library`);
      const theme = await loadFullLibraryTheme(id);
      const mode: StripTheme['mode'] = entry.darkFirst ? 'dark' : 'light';
      const all = themeVariables({ theme, mode });
      const vars: Record<string, string> = {};
      for (const name of STRIP_VARS) {
        const value = all[name];
        if (value === undefined) throw new Error(`theme "${id}" has no ${name} variable`);
        vars[name] = value;
      }
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        contrastLevel: entry.contrastLevel,
        mode,
        vars,
      };
    })
  );
}

/** The library theme count, computed at build — never a hardcoded number. */
export async function libraryThemeCount(): Promise<number> {
  const { getFullThemeLibraryMeta } = await import('@texuli/tokens/library-expand');
  return (await getFullThemeLibraryMeta()).length;
}

/** A card's variables as one static style-attribute value (`--tx-*:value;…`). */
export function stripVarsStyle(vars: Readonly<Record<string, string>>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}
