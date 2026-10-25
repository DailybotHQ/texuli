import type { Theme, ThemeCharts } from '../contract/types.ts';
import { loadPortDefinitionsModule } from './loaders.ts';
import { THEME_LIBRARY_META as sourceMetadata } from './metadata.ts';
import type {
  LibraryThemeDefinition,
  LibraryThemeMeta,
  ThemeCollection,
  ThemeMood,
} from './types.ts';
import { THEME_COLLECTIONS } from './types.ts';

/**
 * Immutable browse catalog. Importing it loads the single `records` module
 * (one source of truth) but not the builder or generator.
 */
export const THEME_LIBRARY_META: readonly LibraryThemeMeta[] = sourceMetadata;

const metaById = new Map(THEME_LIBRARY_META.map((metadata) => [metadata.id, metadata]));
const themeCache = new Map<string, Promise<Theme>>();

/** Cached promise for the single definitions chunk. */
let definitionsModule: Promise<typeof import('./definitions.ts')> | undefined;

function loadDefinitions(): Promise<typeof import('./definitions.ts')> {
  definitionsModule ??= loadPortDefinitionsModule();
  return definitionsModule;
}

export function listThemeLibrary(filter?: {
  category?: string;
  tag?: string;
  collection?: ThemeCollection;
  mood?: ThemeMood;
}): readonly LibraryThemeMeta[] {
  return THEME_LIBRARY_META.filter((metadata) => {
    if (filter?.category && metadata.category !== filter.category) return false;
    if (filter?.tag && !metadata.tags.includes(filter.tag)) return false;
    if (filter?.collection && metadata.collection !== filter.collection) return false;
    if (filter?.mood && !metadata.mood.includes(filter.mood)) return false;
    return true;
  });
}

function fieldScore(metadata: LibraryThemeMeta, word: string): number {
  if (metadata.name.toLowerCase().includes(word) || metadata.id.includes(word)) return 3;
  if (
    metadata.tags.some((tag) => tag.toLowerCase().includes(word)) ||
    metadata.mood.some((mood) => mood.includes(word)) ||
    metadata.category.toLowerCase().includes(word) ||
    metadata.collection.includes(word)
  ) {
    return 2;
  }
  return metadata.description.toLowerCase().includes(word) ? 1 : 0;
}

/** Every query word must match; name/id rank above tags and descriptive text. */
export function searchThemeLibrary(query: string): readonly LibraryThemeMeta[] {
  if (typeof query !== 'string') throw new TypeError('Theme search query must be a string');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return THEME_LIBRARY_META;
  const matches: { metadata: LibraryThemeMeta; score: number; index: number }[] = [];
  THEME_LIBRARY_META.forEach((metadata, index) => {
    let score = 0;
    for (const word of words) {
      const field = fieldScore(metadata, word);
      if (field === 0) return;
      score += field;
    }
    matches.push({ metadata, score, index });
  });
  return matches
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ metadata }) => metadata);
}

export function listCollections(): readonly { id: ThemeCollection; count: number }[] {
  return THEME_COLLECTIONS.map((id) => ({
    id,
    count: THEME_LIBRARY_META.filter((metadata) => metadata.collection === id).length,
  }));
}

export function getLibraryThemeMeta(id: string): LibraryThemeMeta | undefined {
  return metaById.get(id);
}

function unknownTheme(id: string): TypeError {
  return new TypeError(
    `Unknown library theme "${id}". Known ids: ${THEME_LIBRARY_META.map(({ id: name }) => name).join(', ')}`
  );
}

/** Fetch one theme definition from the single lazy definitions chunk. */
export async function loadLibraryThemeDefinition(id: string): Promise<LibraryThemeDefinition> {
  if (!metaById.has(id)) throw unknownTheme(id);
  const mod = await loadDefinitions();
  return mod.requirePortThemeRecord(id);
}

/**
 * Load one theme's definition and build light/dark token sets on demand.
 * Builder validation is DEV/test-only (see `buildLibraryTheme`).
 */
export async function loadLibraryTheme(id: string): Promise<Theme> {
  if (!metaById.has(id)) throw unknownTheme(id);
  let loaded = themeCache.get(id);
  if (!loaded) {
    loaded = Promise.all([loadDefinitions(), import('./build.ts')]).then(
      ([defs, { buildLibraryTheme }]) => buildLibraryTheme(defs.requirePortThemeRecord(id))
    );
    themeCache.set(id, loaded);
    loaded.catch(() => themeCache.delete(id));
  }
  return structuredClone(await loaded);
}

/** Build chart color data only for consumers that need the optional chart palette. */
export async function loadLibraryThemeCharts(id: string): Promise<ThemeCharts> {
  const [definition, theme, chartBuilder] = await Promise.all([
    loadLibraryThemeDefinition(id),
    loadLibraryTheme(id),
    import('./charts.ts'),
  ]);
  return structuredClone(chartBuilder.buildLibraryThemeCharts(definition, theme));
}

export async function loadAllLibraryThemes(): Promise<readonly Theme[]> {
  return Promise.all(THEME_LIBRARY_META.map(({ id }) => loadLibraryTheme(id)));
}

/** Clear in-memory results; useful to isolate test cases and long-lived editors. */
export function clearLibraryThemeCache(): void {
  themeCache.clear();
  definitionsModule = undefined;
}
