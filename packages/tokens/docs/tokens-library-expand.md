# Tokens: Expand the library to 200+ themes

**Package:** `@texuli/tokens`  
**Source:** `packages/tokens/src/library-expand/`  
**Tests:** `packages/tokens/tests/library-expand.test.ts`  
**Task:** T-tokens-library-expand

## What shipped

| Set | Count | Notes |
| --- | --- | --- |
| Ported library (`@texuli/tokens/library`) | 64 | Unchanged; still the industry/brand/HC/colorblind/seasonal/mono catalog |
| Expanded set (`@texuli/tokens/library-expand`) | **146** | 6 Protoyard built-ins + 140 curated |
| **Full catalog** | **210** | `FULL_THEME_LIBRARY_META` = port ∪ expand |

## Protoyard built-in ports (first six expand entries)

| Id | Seed (primary) | Notes vs Protoyard |
| --- | --- | --- |
| `violet` | `#7c3aed` | Same accent seed as Protoyard `violetTheme` primary 600; neutrals via zinc scale through the Texuli palette engine |
| `ocean` | `#2563eb` | Blue 600 + slate neutral (Protoyard ocean) |
| `emerald` | `#047857` | Emerald 700 + gray (Protoyard emerald light primary) |
| `rose` | `#be123c` | Rose 700 + stone, larger radius 0.875rem |
| `amber` | `#b45309` | Amber 700 + stone |
| `monochrome` | `#18181b` | Zinc 900 primary, flat elevation, tighter radius |

**Builder:** `buildLibraryTheme` uses `generateThemeFromSeed` (same approach as
Protoyard’s `createThemeFromSeed`), then applies definition font/radius/density/style.
Solid fills are dual-safe for outline ink on page surfaces (component AA). No APCA.

## Quality gates (FIX-library-expand-quality)

- Expand **meta carries `neutral`** for every theme (from definition rows).
- **No duplicate** `(seed, neutral, mood)` combos; **min primary OKLab dE ≥ 0.02**
  between expand seeds (curated; near-duplicates nudged).
- Ported 64 match the seed engine **field-for-field within OKLab dE 0.01**
  (`packages/tokens/tests/library-quality.test.ts`).
- Full catalog stays **≥ 200** unique themes; AA/AAA text pairs and component
  contrast stay green.

## Curated families (140)

14 themes each: **neutral**, **warm**, **cool**, **vivid**, **pastel**, **earthy**, **brand-like**, **editorial**, **terminal** (dark-first), **high-contrast** (AAA).

## API

```ts
import {
  BUILTIN_PRESET_IDS,
  EXPAND_THEME_LIBRARY_META,
  FULL_THEME_LIBRARY_META,
  listFullThemeLibrary,
  loadExpandTheme,
  loadFullLibraryTheme,
  searchFullThemeLibrary,
} from '@texuli/tokens/library-expand';

await loadExpandTheme('violet');
await loadFullLibraryTheme('harbor-teal'); // port id still works
```

Lazy per-definition modules under `library-expand/themes/`. Chart tokens: `loadFullLibraryThemeCharts(id)`.

## Contrast

Every expand theme is gated in tests for WCAG 2.x AA (AAA for `high-contrast` family and HC collection). APCA is out of scope.
