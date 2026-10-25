# Site performance

**App:** `@texuli/website` (`apps/website`)  
**Path:** `/perf/` (the published budgets)  
**E2E:** `tests/e2e/site-perf.spec.ts`

## Budgets

The budgets live in `src/components/perf/budgets.ts`. The `/perf/` page and the
spec both read them.

| Route | HTML raw | HTML gzip | Page weight (gzip) | JS (gzip) | CLS | LCP (lab) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default (every route) | 224 KB | 24 KB | 96 KB | 64 KB | 0.1 | 2,500 ms |
| `/` (landing) | 224 KB | 24 KB | 152 KB | 116 KB | 0.1 | 3,000 ms |
| `/component-pages/button/` | 224 KB | 24 KB | 112 KB | 72 KB | 0.15 | 2,500 ms |
| `/component-pages/charts-pie/` | 224 KB | 24 KB | 120 KB | 80 KB | 0.15 | 2,500 ms |
| `/charts-page/` | 224 KB | 28 KB | 96 KB | 64 KB | 0.1 | 2,500 ms |
| `/gallery-themes/` | 224 KB | 24 KB | 132 KB | 64 KB | 0.1 | 2,500 ms |
| `/theme-switcher/` | 224 KB | 24 KB | 100 KB | 64 KB | 0.1 | 2,500 ms |
| `/color-explorer/` | 304 KB | 34 KB | 112 KB | 64 KB | 0.1 | 2,500 ms |
| `/gallery-components/` | 880 KB | 48 KB | 184 KB | 88 KB | 0.1 | 2,500 ms |
| `/examples/` | 736 KB | 64 KB | 200 KB | 104 KB | 0.1 | 2,500 ms |
| `/examples/<id>/` (prefix) | 224 KB | 32 KB | 184 KB | 116 KB | 0.1 | 2,500 ms |
| `/search/` | 224 KB | 24 KB | 96 KB | 68 KB | 0.1 | 2,500 ms |
| `/primitives-page/<id>/` | 224 KB | 24 KB | 160 KB | 108 KB | 0.1 | 2,500 ms |

Each override in `budgets.ts` states its measured numbers. `ROUTE_PREFIX_BUDGETS`
gives a family of routes one limit (an exact entry wins over a prefix).

The raw HTML limits include the docs sidebar on every page, which links every
component and primitive page: about 40 KB raw and 3 KB gzip
(`docs/site-sidebar-nav.md`).

- **Page weight:** every same-origin file a page loads until the network is
  idle, gzipped at level 9 from `dist`.
- **Islands:** each hydrated island must contain something a person can
  operate. The one exception is `SearchResults`, which hydrates to show the
  results of the search field; it is listed in `OUTPUT_ISLANDS` with its
  reason.
- **CLS:** layout-shift entries during load. It is checked in Chromium engines,
  because WebKit doesn't report them.
- **LCP:** checked only with `TEXULI_PERF=1`. It is wall-clock, and the default
  suite never asserts timings.

## What changed to meet them

The theme gallery, the theme switcher and the color explorer inlined every
library theme:

| Route | Before | After |
| --- | --- | --- |
| `/color-explorer/` | 12.7 MB raw / 600 KB gzip | 229 KB / 23.6 KB |
| `/gallery-themes/` | 2.5 MB / 110 KB | 594 KB / 29.9 KB |
| `/theme-switcher/` | 1.7 MB / 91 KB | 251 KB / 22.6 KB |

- **Per-theme files:** each theme is now a static, same-origin file, built
  once.
  - `/theme-css/<id>.css`: about 1–2 KB gzip. It holds the same
    `[data-tx-theme][data-tx-mode]` rules the pages used to inline.
  - `/theme-data/<id>.json`: the color explorer payload.

  They come from `src/pages/theme-css/[id].css.ts` and
  `src/pages/theme-data/[id].json.ts`, through
  `src/components/perf/theme-build.ts`.
- **Loading** (`src/components/perf/theme-assets.ts`):
  - `ensureThemeCss(id)` adds one `<link>` per theme and resolves once it has
    loaded.
  - `loadThemeCssWhenVisible(id)` loads a gallery card's theme when the card
    comes near the viewport.
  - `loadThemeData(id)` fetches an explorer payload once.
  - Ids are checked against `THEME_ASSET_ID`, and paths are relative to the
    site base, so nothing leaves the origin.
- **Apply waits for the CSS:** the switcher, gallery and explorer load the
  theme's CSS before applying it, because the appearance cache captures the
  computed variables.
  - Their mount effects run once (`untrack`). Otherwise, selecting a theme
    re-ran them and restored the cached theme while the CSS was loading.
- **Gallery pagination:** the gallery renders 24 cards at a time. "Show more"
  adds 24, focus moves to the first new card, and a new filter starts over.
- **Explorer:** it ships the theme list and the default theme's payload, and
  fetches the payload of a theme when it is chosen.
- **AppNav:** the drawer (`texuli/sidebar`) was already lazy on `dev`.
  `AppNavDrawer.svelte` loads on first open, so `texuli/sidebar` was 16.76 KiB
  initial with a 9.40 KiB lazy drawer chunk. No change was needed. (`pnpm size`
  on 2026-10-24: 17.78 KiB initial, 9.75 KiB lazy.)

## Validate

```bash
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts
TEXULI_PERF=1 TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts   # adds LCP
```

The spec checks:
- **HTML budgets:** every built HTML route is within its document budget.
- **Theme files:** there are 210 of each; each CSS file is under 4 KB gzip and
  each JSON file under 16 KB gzip.
- **Routes:** 20 routes covering every page family (`BROWSER_ROUTES`). Each
  has no foreign requests, stays within its page weight and JS budgets, has no
  idle islands, and keeps CLS within budget.
- **Gallery:** it loads theme CSS only for the cards it shows, and paging adds
  cards with focus following.
- **Switcher:** applying a theme fetches `/theme-css/<id>.css` and changes the
  computed tokens.
- **Explorer:** choosing a theme fetches `/theme-data/<id>.json` and its CSS.
- **`/perf/`:** it lists every override and passes axe in light and dark.

Projects: Chromium, WebKit and Pixel 7.

## Limits

- **Lab numbers only,** from a local static server. There is no field data and
  no network throttling.
- **Shared JS:** every page ships about 46 KB gzip, mostly the island runtime
  and the theme switch. The search palette and its index load on first use
  (`docs/site-sidebar-nav.md`).
- **Gallery data:** the gallery still ships the scores of all 210 themes as
  island props (about 500 KB raw), because its filter works on the whole
  library.

## FIX-site-perf-routes (shrink first, then honest limits)

- **The defaults are restored** to 224 / 24 / 96 / 64 KB. They had been raised
  to 280 / 40 / 120 / 72 for every route.
- **Header logo:** a copy pre-scaled to 72px tall (`texuli-logo-*-72.png`,
  about 4 KB) replaces the 3332x972 artwork (11 to 13 KB). The hidden mode's
  copy loads lazily, so a page fetches one logo instead of two: about 7 KB
  less on every page.
- **Theme lists as JSON:** `/theme-switcher/` and `/gallery-themes/` render
  their first themes and fetch the full list after mount, from
  `/theme-catalog.json` and `/theme-gallery.json`.
- **Example registry loads on the client:** `ExampleHost` imports
  `@texuli/examples` lazily, so the build no longer inlines every demo's CSS
  into each example page.
- **Measured:** external stylesheets (`inlineStylesheets: 'never'`) were
  heavier on a first visit for every route (+3 to +42 KB and up to 278
  requests), so the default inlining stays.
