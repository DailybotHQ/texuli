/**
 * Build-time sources for the per-theme static files (T-site-perf). Runs only
 * during the Astro build; each theme's CSS matches the rules the pages used to
 * inline for all 210 themes at once.
 */
import { defineTheme, themeVariables } from '@texuli/tokens';
import { getFullThemeLibraryMeta, loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { buildColorExplorerThemes, type ExplorerThemePayload } from '../color-explorer/build.ts';

/** Every library theme id, for `getStaticPaths`. */
export async function libraryThemeIds(): Promise<string[]> {
  return (await getFullThemeLibraryMeta()).map((meta) => meta.id);
}

function declareBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

/** One theme's light and dark rules, in the `tx.base` layer. */
export async function buildThemeCssFile(id: string): Promise<string> {
  const theme = defineTheme(await loadFullLibraryTheme(id));
  const rules = (['light', 'dark'] as const).map(
    (mode) =>
      `[data-tx-theme='${theme.id}'][data-tx-mode='${mode}']{${declareBlock(themeVariables({ theme, mode }))}}`
  );
  return `@layer tx.base{${rules.join('')}}\n`;
}

let explorerThemes: Promise<readonly ExplorerThemePayload[]> | undefined;

/** The explorer payload of one theme (computed once per build, for all files). */
export async function buildExplorerThemeFile(
  id: string
): Promise<ExplorerThemePayload | undefined> {
  explorerThemes ??= buildColorExplorerThemes();
  return (await explorerThemes).find((theme) => theme.id === id);
}

/** The explorer's theme list without payloads (what the page itself ships). */
export async function explorerCatalog(): Promise<
  Pick<ExplorerThemePayload, 'id' | 'name' | 'category' | 'contrastLevel' | 'description'>[]
> {
  explorerThemes ??= buildColorExplorerThemes();
  return (await explorerThemes).map(({ id, name, category, contrastLevel, description }) => ({
    id,
    name,
    category,
    contrastLevel,
    description,
  }));
}
