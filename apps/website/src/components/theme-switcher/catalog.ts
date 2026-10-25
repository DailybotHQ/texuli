/**
 * Client-safe theme catalog helpers (T-site-perf): plain data and a filter,
 * with no `@texuli/tokens` import, so islands that only browse the catalog do
 * not pull the token engine or the library loaders into the browser.
 */

/** Key colors painted on each theme card (hex from that theme's light palette). */
export interface ThemeSwatchColors {
  background: string;
  foreground: string;
  primary: string;
  accent: string;
  surface: string;
}

/** Serializable catalog row for the switcher island. */
export interface ThemeCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  collection: string;
  tags: readonly string[];
  /** The theme's light palette (its own colors, never the active site theme). */
  swatches: ThemeSwatchColors;
  /**
   * The theme's dark palette, at build time only: the switcher reads it from
   * `/theme-catalog-dark.json` while the site is dark.
   */
  swatchesDark?: ThemeSwatchColors;
}

/** Filter catalog entries by a free-text query (id, name, category, tags). */
export function filterThemeCatalog(
  catalog: readonly ThemeCatalogEntry[],
  query: string
): readonly ThemeCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;
  const words = q.split(/\s+/).filter(Boolean);
  return catalog.filter((entry) => {
    const hay = [
      entry.id,
      entry.name,
      entry.description,
      entry.category,
      entry.collection,
      ...entry.tags,
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}
