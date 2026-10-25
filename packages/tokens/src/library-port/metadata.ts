/**
 * Browse metadata for the 64-theme port — derived from {@link PORT_THEME_RECORDS}
 * (one source of truth). Importing this module does not load the builder.
 */
import { PORT_THEME_RECORDS } from './records.ts';
import type { LibraryThemeDefinition, LibraryThemeMeta } from './types.ts';

/** Project a full library record down to browse-only fields. */
export function definitionToMeta(definition: LibraryThemeDefinition): LibraryThemeMeta {
  const meta: LibraryThemeMeta = {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    tags: definition.tags,
    collection: definition.collection ?? 'industry',
    mood: definition.mood ?? [],
    darkFirst: definition.darkFirst ?? false,
    contrastLevel: definition.contrastLevel ?? 'AA',
    seed: definition.seed,
  };
  if (definition.secondary) meta.secondary = definition.secondary;
  if (definition.neutral) meta.neutral = definition.neutral;
  return meta;
}

/** Immutable browse catalog. Same records as definitions; no second hand-maintained list. */
export const THEME_LIBRARY_META: readonly LibraryThemeMeta[] = Object.freeze(
  PORT_THEME_RECORDS.map((record) =>
    Object.freeze({
      ...definitionToMeta(record),
      tags: Object.freeze([...record.tags]),
      mood: Object.freeze([...(record.mood ?? [])]),
    })
  )
);
