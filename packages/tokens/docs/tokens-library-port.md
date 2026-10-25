# Theme library (64-theme port)

`@texuli/tokens/library` exposes the 64-theme browse catalog and loads full
theme data on demand.

## Compact shape (FIX-port-compact)

| Piece | Role |
| --- | --- |
| `library-port/records.ts` | **One source of truth** — every port theme’s definition fields |
| `library-port/metadata.ts` | `THEME_LIBRARY_META` derived via `definitionToMeta` (not a second hand list) |
| `library-port/definitions.ts` | Lazy entry re-exporting records (one chunk, not 64 modules) |
| `library-port/build.ts` | `generateThemeFromSeed` + finish; **no `defineTheme` in the prod path** |

```ts
import {
  listThemeLibrary,
  loadLibraryTheme,
  searchThemeLibrary,
  THEME_LIBRARY_META,
} from '@texuli/tokens/library';

const choices = searchThemeLibrary('logistics teal');
const theme = await loadLibraryTheme(choices[0]!.id);
```

Importing `THEME_LIBRARY_META` stays static and tree-shakes away the builder.
`loadLibraryTheme()` loads the single records chunk once, then builds. Chart
tokens remain optional via `loadLibraryThemeCharts(id)`.

## Validation

`buildLibraryTheme` does **not** call `defineTheme` (keeps `@texuli/tokens/build`
free of the schema walker). The seed engine still enforces contrast. Tests call
`defineTheme(buildLibraryTheme(def))` to keep the contract gate.

## Port identity (FIX-port-identity)

`LIBRARY_THEME_IDS` freezes the Protoyard/pre-compact catalog order (fieldwork
at index 39; graphite then sepia-print at the end). Documented nudges only:

| Id | Original seed | Current | Notes |
| --- | --- | --- | --- |
| `productivity-minimal` | `#18181b` | `#1e293b` | Slate; **neutral unset** |
| `climate-earth` | `#15803d` | `#008f41` | Same-hue green; built primary dE ≥ 0.04 vs health-clinic |

## Port seeds (FIX-port-seeds)

Port records match the Protoyard 64 / pre-compact Texuli fields. The only
documented seed nudge is `productivity-minimal` (`#18181b` → `#1e293b`, same
slate family) so it stays distinct from `security-vault`. `health-clinic` and
`climate-earth` keep their original greens (already above the dE floor).

A hue-family guard (`hue-family.ts`) checks all 210 catalog seeds against
reviewed id/name color words.

## Distinct primaries

Port seeds stay pairwise OKLab dE ≥ 0.02, including the named pairs
`health-clinic` ~ `climate-earth` and `security-vault` ~ `productivity-minimal`
(`library-quality.test.ts`).

## Single-theme builder

Consumers that only need one theme without the catalog:

```ts
import { buildLibraryTheme } from '@texuli/tokens/build';
```

## Notes

APCA is out of scope. This subpath does not load CSS; stylesheets are owned by
the token CSS layer.
