/**
 * The theme side of the CLI. It holds no theme logic of its own: `list` and
 * `preview` run the `theme.search` and `theme.preview` operations, and the
 * helpers come from the one theme implementation in `../ops/themes.ts`.
 * Offline: every theme ships inside `@texuli/tokens`.
 */

import {
  THEME_SEARCH_MAX,
  type ThemePreview,
  type ThemeSummary,
  texuliOps,
  themeSummary,
} from '../ops/index.ts';

export {
  PREVIEW_TOKENS,
  type ThemePreview,
  type ThemeSummary,
  themeCss,
  themeExists,
} from '../ops/index.ts';

/** Every theme, or those matching `search` (all words must match, ranked). */
export async function listThemes(search?: string): Promise<ThemeSummary[]> {
  const outcome = await texuliOps.invoke('theme.search', {
    ...(search?.trim() ? { query: search.trim() } : {}),
    limit: THEME_SEARCH_MAX,
  });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return (outcome.output as { themes: ThemeSummary[] }).themes.map(themeSummary);
}

/** Key tokens and the AA report for one theme in one mode, or `null` for an unknown id. */
export async function previewTheme(
  id: string,
  mode: 'light' | 'dark'
): Promise<ThemePreview | null> {
  const outcome = await texuliOps.invoke('theme.preview', { id, mode });
  if (outcome.ok) return outcome.output as ThemePreview;
  if (outcome.error.code === 'not-found' || outcome.error.code === 'invalid-input') return null;
  throw new Error(outcome.error.message);
}
