/**
 * `@texuli/tokens/library-ids` (G125): every theme id of the library, with
 * no metadata, for a host that validates ids synchronously (a player boot
 * path) without loading the catalog rows of `@texuli/tokens/library-expand`.
 *
 * Three disjoint sets, generated from the libraries' own sources
 * (`src/library-ids/ids.ts`, written by `packages/tokens/scripts/generate.ts`):
 * - `builtin`: the 6 Protoyard built-ins (the first entries of `@texuli/tokens/library-expand`);
 * - `port`: the 64 themes of `@texuli/tokens/library`;
 * - `expand`: the 140 curated themes of `@texuli/tokens/library-expand` after the built-ins.
 */
import { BUILTIN_THEME_IDS, EXPAND_THEME_IDS, PORT_THEME_IDS } from './ids.ts';

export { BUILTIN_THEME_IDS, EXPAND_THEME_IDS, PORT_THEME_IDS };

/** The set a library theme id belongs to. */
export type LibraryThemeSet = 'builtin' | 'port' | 'expand';

/** Any id of the library (210 in 0.10). */
export type LibraryThemeId =
  | (typeof BUILTIN_THEME_IDS)[number]
  | (typeof PORT_THEME_IDS)[number]
  | (typeof EXPAND_THEME_IDS)[number];

/**
 * Every library id in the full catalog order (`getFullThemeLibraryMeta()`):
 * the port, then the built-ins, then the curated expand themes.
 */
export const LIBRARY_THEME_IDS: readonly LibraryThemeId[] = Object.freeze([
  ...PORT_THEME_IDS,
  ...BUILTIN_THEME_IDS,
  ...EXPAND_THEME_IDS,
]);

const SET_OF = new Map<string, LibraryThemeSet>();
for (const id of BUILTIN_THEME_IDS) SET_OF.set(id, 'builtin');
for (const id of PORT_THEME_IDS) SET_OF.set(id, 'port');
for (const id of EXPAND_THEME_IDS) SET_OF.set(id, 'expand');

/** True when `id` names a library theme (any set). Never true for a non-string. */
export function isLibraryThemeId(id: unknown): id is LibraryThemeId {
  return typeof id === 'string' && SET_OF.has(id);
}

/** The set `id` belongs to, or `undefined` when it is not a library id. */
export function libraryThemeSet(id: unknown): LibraryThemeSet | undefined {
  return typeof id === 'string' ? SET_OF.get(id) : undefined;
}
