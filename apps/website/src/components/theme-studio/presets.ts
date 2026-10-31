/**
 * Starting points shared by the design-system studio and the legacy theme
 * helpers (T-82 punch-list row 2): fictional seed colors and a featured slice
 * of the library. No imports, so the studio island lists them for free.
 */

/** A one-click brand seed shown as a starting point in the studio. */
export type StudioSeedPreset = { id: string; label: string; hex: string };

/**
 * Fictional seed colors with stable hexes. Every hex passes `normalizeHex`,
 * so a click can never land the visitor in an error state (punch-list row 2).
 */
export const STUDIO_SEED_PRESETS: readonly StudioSeedPreset[] = Object.freeze([
  { id: 'harbor', label: 'Harbor blue', hex: '#2b6ce0' },
  { id: 'signal', label: 'Signal red', hex: '#e11d48' },
  { id: 'moss', label: 'Moss green', hex: '#3f6212' },
  { id: 'teal-tide', label: 'Teal tide', hex: '#0f766e' },
  { id: 'amber-dusk', label: 'Amber dusk', hex: '#b45309' },
  { id: 'grape', label: 'Grape', hex: '#7c3aed' },
  { id: 'ink-slate', label: 'Ink slate', hex: '#334155' },
  { id: 'rosewood', label: 'Rosewood', hex: '#9f1239' },
]);

/** A library theme featured as a starting point, with its gallery category. */
export type StudioLibraryTheme = { id: string; category: string };

/**
 * A small, budgeted slice of the 210-theme library. Payloads load from
 * `/theme-data/<id>.json` on click (same origin, one file per theme), never
 * upfront — the studio's first paint stays the default seed.
 */
export const FEATURED_LIBRARY_THEMES: readonly StudioLibraryTheme[] = Object.freeze([
  { id: 'enterprise-neutral', category: 'enterprise' },
  { id: 'editorial-luxury', category: 'editorial' },
  { id: 'devtools-night', category: 'devtools' },
  { id: 'playful-consumer', category: 'consumer' },
  { id: 'gaming-neon', category: 'gaming' },
  { id: 'okabe-blue', category: 'analytics' },
  { id: 'contrast-paper', category: 'accessible' },
  { id: 'retro-terminal', category: 'retro' },
]);

/** `devtools-night` → `Devtools night`, for buttons that predate the payload. */
export function humanizeThemeId(id: string): string {
  return id
    .split('-')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
