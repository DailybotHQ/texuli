# Library theme ids

**Package:** `@texuli/tokens`
**Subpath:** `@texuli/tokens/library-ids` (unreleased, planned for `0.10.1`; G125)
**Source:** `packages/tokens/src/library-ids/` (`ids.ts` is generated)
**Tests:** `packages/tokens/tests/library-ids.test.ts`

Every theme id of the library, with no metadata. A host that only needs to
know whether an id names a library theme (a player boot path validating a
stored theme id, for example) imports this entry synchronously instead of
`@texuli/tokens/library-expand`, whose catalog rows carry names, tags,
moods, seeds and descriptions for all 146 expanded themes.

## The three sets

The library has three disjoint sets, 210 ids in all:

| Set | Count | Where the themes load from |
| --- | --- | --- |
| `builtin` | 6 | `@texuli/tokens/library-expand` (its first six entries: `violet`, `ocean`, `emerald`, `rose`, `amber`, `monochrome`) |
| `port` | 64 | `@texuli/tokens/library` |
| `expand` | 140 | `@texuli/tokens/library-expand` (the curated themes after the built-ins) |

`@texuli/tokens/library-expand` is the `builtin` set plus the `expand` set
(146 ids). `BUILTIN_THEME_IDS` equals its `BUILTIN_PRESET_IDS`.

## API

```ts
import {
  BUILTIN_THEME_IDS, // readonly tuple of the 6 built-in ids
  EXPAND_THEME_IDS, // readonly tuple of the 140 curated expand ids
  isLibraryThemeId, // (id: unknown) => id is LibraryThemeId
  LIBRARY_THEME_IDS, // all 210 ids: port, then built-ins, then expand
  type LibraryThemeId, // union of every id literal
  type LibraryThemeSet, // 'builtin' | 'port' | 'expand'
  libraryThemeSet, // (id: unknown) => LibraryThemeSet | undefined
  PORT_THEME_IDS, // readonly tuple of the 64 port ids
} from '@texuli/tokens/library-ids';

isLibraryThemeId('terracotta-hearth'); // true
libraryThemeSet('violet'); // 'builtin'
libraryThemeSet('harbor-teal'); // 'port'
isLibraryThemeId('toString'); // false (a lookup table, not an object key check)
```

`LIBRARY_THEME_IDS` is frozen and has the same order as
`await getFullThemeLibraryMeta()` from `@texuli/tokens/library-expand`.
`isLibraryThemeId` and `libraryThemeSet` accept any value and are false or
`undefined` for anything that is not a string id of the library.

To load a theme, keep using `loadFullLibraryTheme(id)` from
`@texuli/tokens/library-expand` (or `loadLibraryTheme(id)` from
`@texuli/tokens/library` for a port id).

## Generated, so it cannot drift

`src/library-ids/ids.ts` is written by
`pnpm exec tsx packages/tokens/scripts/generate.ts` from the libraries' own
sources: the port records (`PORT_THEME_RECORDS`) and the expand definition
modules (`library-expand/themes/*.ts`). The same run writes the expand
catalog rows (`library-expand/metadata.ts`). `--check` fails on drift, and
`tests/library-ids.test.ts` compares the file with the renderer, asserts that
the ids equal the union of the three libraries (210) and that the sets are
disjoint, and checks that the entry imports nothing but its generated table.

## Size

The entry is in `texuli.budgets.json` at measured + 4%, rounded up to 64 B:
measured 1,730 B gzip (3,273 B raw), budget 1,856 B. For comparison,
`@texuli/tokens/library-expand` measures 6,408 B gzip.
