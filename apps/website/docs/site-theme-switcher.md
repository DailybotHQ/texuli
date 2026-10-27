# texuli.com: theme and mode switcher

**App:** `apps/website`  
**Route:** `/theme-switcher/`  
**Components:** `src/components/theme-switcher/`  
**Tests:** `tests/e2e/site-theme-switcher.spec.ts`

## Goal

Pick any of the **200+** library themes and a color mode (**light**, **dark**,
**high-contrast**, or **system**) for the whole site. The choice is
**persisted**, applied **before first paint** (no flash), and the page is
**static** with **no runtime network**.

## How it works

| Piece | Role |
| --- | --- |
| `buildThemeCatalog()` | Full metadata from `@texuli/tokens/library-expand` (`getFullThemeLibraryMeta`, 210 themes) |
| `buildThemeLibraryCss()` | Compact light+dark CSS for every theme, scoped by `data-tx-theme` + `data-tx-mode` |
| `buildHighContrastModeCss()` | System-color rules for `data-tx-mode="high-contrast"` |
| `ThemeSwitcher.svelte` | Client island: mode toggle, filter, theme listbox |
| `applySiteAppearance()` | Sets root attributes, captures or injects `--tx-*` vars, writes the no-flash appearance cache (`@texuli/tokens/no-flash`) |

The library CSS is **inlined only on this page** at build time. When the user
picks a theme, the switcher **captures computed variables** (or injects
high-contrast system colors) into `cacheAppearance`. Every other page's
`BaseLayout` already runs `noFlashScript('texuli-site', 'system')`, which
replays `themeId`, `mode` and safe `--tx-*` vars before paint — so the whole
site follows the choice without shipping 200 themes on every URL.

## Modes

| Choice | Behavior |
| --- | --- |
| Light / Dark | Explicit mode; cached with theme vars |
| High contrast | System color keywords (`Canvas`, `CanvasText`, …); explicit mode, not only `forced-colors` |
| System | Follows `prefers-color-scheme` and `prefers-contrast: more`; cache keeps the current resolution so other pages still paint; the island re-syncs on change |

## Usage

```bash
pnpm build
# open apps/website/dist/theme-switcher/ or:
pnpm --filter @texuli/website preview
```

```ts
import {
  applySiteAppearance,
  buildThemeCatalog,
  filterThemeCatalog,
} from '../components/theme-switcher/index.ts';
```

## Tests

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4910 pnpm exec playwright test tests/e2e/site-theme-switcher.spec.ts'
```

The spec (one test on Chromium since the 2026-10-27 trim) serves
`apps/website/dist` on a free loopback port and checks:

- the page lists the library (200+ themes), and two cards paint two
  different primaries in the active mode's palette;
- mode and theme changes update `data-tx-theme` / `data-tx-mode`; dark mode
  lowers the background luminance; high contrast sets
  `data-tx-mode="high-contrast"`;
- the search filter;
- persistence: a reload keeps theme and mode with no flash;
- no request leaves the origin.

The catalog, filters and swatch colors are unit-tested
(`scripts/tests/site-loaders.test.ts`); axe in light and dark runs in the page
sweep (`a11y-site-<n>.spec.ts`).

## Limits

- Swatch previews on each card use the **active** site tokens (not per-card
  isolated previews). Full per-card isolation is a gallery/studio concern.
- “System” across a cold load without the island uses the last **resolved**
  mode from the appearance cache (honest no-flash); the island restores live
  OS following after hydrate.
- Primary nav does not yet link here (foundation `NAV`); open `/theme-switcher/`
  directly until the lead folds the link.
- Underscore-free theme ids only (library contract).
