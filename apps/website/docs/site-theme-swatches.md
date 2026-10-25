# Theme swatches (own palette)

**App:** `apps/website`  
**Pages:** `/theme-switcher/`, `/gallery-themes/`  
**Tests:** `scripts/tests/site-theme-swatches.test.ts`, `tests/e2e/site-theme-swatches.spec.ts`

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
pnpm vitest run scripts/tests/site-theme-swatches.test.ts
pnpm build
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-theme-swatches.spec.ts
```
