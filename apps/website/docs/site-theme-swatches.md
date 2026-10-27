# Theme swatches (own palette)

**App:** `apps/website`  
**Pages:** `/theme-switcher/`, `/gallery-themes/`  
**Tests:** `scripts/tests/site-loaders.test.ts`, `tests/e2e/site-theme-switcher.spec.ts` and `tests/e2e/site-gallery-themes.spec.ts` (two cards paint two different primaries)

## Goal

Every theme card paints **that theme’s** primary, accent, surface, background and
foreground — never the active site theme’s CSS variables.

## How

| Surface | Mechanism |
| --- | --- |
| Theme switcher | `buildThemeCatalog()` embeds light-palette hexes on each `ThemeCatalogEntry.swatches`; chips use `style:background={…}` |
| Theme gallery | `buildGalleryThemeCards()` already had per-mode hex swatches; dots use those inline (not `var(--tx-*)`) |
| Landing strip | Removed with T-site-ia (`ThemesStrip` / `AnnouncementBanner` deleted) |

`data-tx-swatch-primary` on each card carries the primary hex for e2e asserts.

## Validate

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
pnpm build
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-theme-switcher.spec.ts tests/e2e/site-gallery-themes.spec.ts
```
