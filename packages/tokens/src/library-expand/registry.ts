import type { Theme, ThemeCharts } from '../contract/types.ts';
import type {
  LibraryThemeDefinition,
  LibraryThemeLoader,
  LibraryThemeMeta,
  ThemeCollection,
  ThemeMood,
} from '../library-port/types.ts';
import { THEME_COLLECTIONS } from '../library-port/types.ts';
import { EXPAND_THEME_ROWS, expandRowToMeta } from './metadata.ts';

/**
 * Expanded set only: 6 Protoyard built-ins + 140 curated themes.
 * Metadata is compact (rows only). Definition loaders and the port catalog
 * load on first use — no top-level import of `./loaders` or `library-port/registry`
 * so a root-barrel consumer that tree-shakes expand away never pays for them.
 */
export const EXPAND_THEME_LIBRARY_META: readonly LibraryThemeMeta[] = Object.freeze(
  EXPAND_THEME_ROWS.map((row) => {
    const meta = expandRowToMeta(row);
    return Object.freeze({
      ...meta,
      tags: Object.freeze([...meta.tags]),
      mood: Object.freeze([...meta.mood]),
    });
  })
);

/** Protoyard six built-in preset ids, first entries of the expanded set. */
export const BUILTIN_PRESET_IDS = [
  'violet',
  'ocean',
  'emerald',
  'rose',
  'amber',
  'monochrome',
] as const;

export type BuiltinPresetId = (typeof BUILTIN_PRESET_IDS)[number];

let expandMetaById: Map<string, LibraryThemeMeta> | undefined;
function metaById(): Map<string, LibraryThemeMeta> {
  expandMetaById ??= new Map(EXPAND_THEME_LIBRARY_META.map((m) => [m.id, m]));
  return expandMetaById;
}

/** Lazy: keep the 146 dynamic-import loaders out of the expand meta graph. */
let expandLoaders: Record<string, LibraryThemeLoader> | undefined;
async function getExpandLoaders(): Promise<Record<string, LibraryThemeLoader>> {
  if (!expandLoaders) {
    const mod = await import('./loaders.ts');
    expandLoaders = mod.EXPAND_THEME_DEFINITION_LOADERS as Record<string, LibraryThemeLoader>;
  }
  return expandLoaders;
}

const expandThemeCache = new Map<string, Promise<Theme>>();

/** Port metadata is loaded once (no builder) so the expand entry stays free of build.ts. */
let portMetaCache: readonly LibraryThemeMeta[] | undefined;
let fullMetaCache: readonly LibraryThemeMeta[] | undefined;

async function loadPortMeta(): Promise<readonly LibraryThemeMeta[]> {
  if (portMetaCache) return portMetaCache;
  const mod = await import('../library-port/metadata.ts');
  const source = mod.THEME_LIBRARY_META as readonly LibraryThemeMeta[];
  portMetaCache = Object.freeze(
    source.map((metadata) =>
      Object.freeze({
        ...metadata,
        tags: Object.freeze([...metadata.tags]),
        mood: Object.freeze([...metadata.mood]),
      })
    )
  );
  return portMetaCache;
}

/**
 * Full browse catalog: ported 64 + expanded 146 = 210 themes.
 * Resolved lazily the first time a full-catalog API is used so the expand
 * entry chunk does not statically import the port registry or builder.
 */
export async function getFullThemeLibraryMeta(): Promise<readonly LibraryThemeMeta[]> {
  if (fullMetaCache) return fullMetaCache;
  const port = await loadPortMeta();
  fullMetaCache = Object.freeze([...port, ...EXPAND_THEME_LIBRARY_META]);
  return fullMetaCache;
}

/** Sync full catalog when already warmed; otherwise expand-only until first full load. */
export function getFullThemeLibraryMetaSync(): readonly LibraryThemeMeta[] {
  return fullMetaCache ?? EXPAND_THEME_LIBRARY_META;
}

/**
 * @deprecated Prefer `getFullThemeLibraryMeta()`. Kept as a sync getter that
 * returns the cached full list after warm-up, else expand-only.
 */
export const FULL_THEME_LIBRARY_META: readonly LibraryThemeMeta[] = EXPAND_THEME_LIBRARY_META;

export function listExpandThemeLibrary(filter?: {
  category?: string;
  tag?: string;
  collection?: ThemeCollection;
  mood?: ThemeMood;
}): readonly LibraryThemeMeta[] {
  return filterMeta(EXPAND_THEME_LIBRARY_META, filter);
}

export async function listFullThemeLibrary(filter?: {
  category?: string;
  tag?: string;
  collection?: ThemeCollection;
  mood?: ThemeMood;
}): Promise<readonly LibraryThemeMeta[]> {
  return filterMeta(await getFullThemeLibraryMeta(), filter);
}

/** Alias used by catalog UIs: all 210 themes once the full meta is resolved. */
export async function listThemeLibrary(filter?: {
  category?: string;
  tag?: string;
  collection?: ThemeCollection;
  mood?: ThemeMood;
}): Promise<readonly LibraryThemeMeta[]> {
  return listFullThemeLibrary(filter);
}

function filterMeta(
  list: readonly LibraryThemeMeta[],
  filter?: {
    category?: string;
    tag?: string;
    collection?: ThemeCollection;
    mood?: ThemeMood;
  }
): readonly LibraryThemeMeta[] {
  return list.filter((metadata) => {
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

function searchList(list: readonly LibraryThemeMeta[], query: string): readonly LibraryThemeMeta[] {
  if (typeof query !== 'string') throw new TypeError('Theme search query must be a string');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return list;
  const matches: { metadata: LibraryThemeMeta; score: number; index: number }[] = [];
  list.forEach((metadata, index) => {
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

export function searchExpandThemeLibrary(query: string): readonly LibraryThemeMeta[] {
  return searchList(EXPAND_THEME_LIBRARY_META, query);
}

export async function searchFullThemeLibrary(query: string): Promise<readonly LibraryThemeMeta[]> {
  return searchList(await getFullThemeLibraryMeta(), query);
}

export async function searchThemeLibrary(query: string): Promise<readonly LibraryThemeMeta[]> {
  return searchFullThemeLibrary(query);
}

export async function listFullCollections(): Promise<
  readonly { id: ThemeCollection; count: number }[]
> {
  const full = await getFullThemeLibraryMeta();
  return THEME_COLLECTIONS.map((id) => ({
    id,
    count: full.filter((metadata) => metadata.collection === id).length,
  }));
}

export function getExpandThemeMeta(id: string): LibraryThemeMeta | undefined {
  return metaById().get(id);
}

export async function getFullThemeMeta(id: string): Promise<LibraryThemeMeta | undefined> {
  const expand = metaById().get(id);
  if (expand) return expand;
  const full = await getFullThemeLibraryMeta();
  return full.find((m) => m.id === id);
}

function unknownExpand(id: string): TypeError {
  return new TypeError(
    `Unknown expand theme "${id}". Known expand ids: ${EXPAND_THEME_LIBRARY_META.map((m) => m.id).join(', ')}`
  );
}

export async function loadExpandThemeDefinition(id: string): Promise<LibraryThemeDefinition> {
  const loaders = await getExpandLoaders();
  const loader = loaders[id];
  if (!loader) throw unknownExpand(id);
  return (await loader()).default;
}

export function clearExpandThemeCache(): void {
  expandThemeCache.clear();
  expandLoaders = undefined;
  expandMetaById = undefined;
  portMetaCache = undefined;
  fullMetaCache = undefined;
}

/**
 * Load one expand theme. Definition loaders and `buildLibraryTheme` arrive
 * through dynamic `import()` so they stay out of the catalog entry chunk.
 */
export async function loadExpandTheme(id: string): Promise<Theme> {
  if (!metaById().has(id)) throw unknownExpand(id);
  let loaded = expandThemeCache.get(id);
  if (!loaded) {
    loaded = Promise.all([getExpandLoaders(), import('../library-port/build.ts')]).then(
      ([loaders, { buildLibraryTheme }]) => {
        const loader = loaders[id];
        if (!loader) throw unknownExpand(id);
        return loader().then(({ default: definition }) => buildLibraryTheme(definition));
      }
    );
    expandThemeCache.set(id, loaded);
    loaded.catch(() => expandThemeCache.delete(id));
  }
  return structuredClone(await loaded);
}

/** Load any theme from the full 210-id catalog (port or expand). */
export async function loadFullLibraryTheme(id: string): Promise<Theme> {
  if (metaById().has(id)) return loadExpandTheme(id);
  const port = await import('../library-port/registry.ts');
  return port.loadLibraryTheme(id);
}

export async function loadFullLibraryThemeDefinition(id: string): Promise<LibraryThemeDefinition> {
  if (metaById().has(id)) return loadExpandThemeDefinition(id);
  const port = await import('../library-port/registry.ts');
  return port.loadLibraryThemeDefinition(id);
}

export async function loadFullLibraryThemeCharts(id: string): Promise<ThemeCharts> {
  if (metaById().has(id)) {
    const [definition, theme, chartsMod] = await Promise.all([
      loadExpandThemeDefinition(id),
      loadExpandTheme(id),
      import('../library-port/charts.ts'),
    ]);
    return chartsMod.buildLibraryThemeCharts(definition, theme);
  }
  const port = await import('../library-port/registry.ts');
  return port.loadLibraryThemeCharts(id);
}

export async function loadAllExpandThemes(): Promise<readonly Theme[]> {
  const themes: Theme[] = [];
  for (const meta of EXPAND_THEME_LIBRARY_META) {
    themes.push(await loadExpandTheme(meta.id));
  }
  return themes;
}

export async function loadAllFullLibraryThemes(): Promise<readonly Theme[]> {
  const full = await getFullThemeLibraryMeta();
  const themes: Theme[] = [];
  for (const meta of full) {
    themes.push(await loadFullLibraryTheme(meta.id));
  }
  return themes;
}
