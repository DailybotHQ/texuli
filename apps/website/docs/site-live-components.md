# Live interactive component pages

**App:** `apps/website`  
**Routes:** `/component-pages/<id>/`  
**Surface:** `src/components/live/`  
**E2E:** `tests/e2e/site-component-pages.spec.ts`  
**Unit:** `scripts/tests/site-loaders.test.ts`  
**A11y:** `tests/e2e/a11y-site-<n>.spec.ts` (zero exclusions on every built page)

## Goal

Every catalog id mounts **its own** real component (charts-pie → PieChart, charts-sankey →
SankeyChart, dropdown-menu → DropdownMenu, layout-sidebar → LayoutHost, …) with an interactive
props panel, live code sample, light/dark + RTL frame, and lazy mount.

## Lazy loading and route budgets

- Component pages hydrate each `LiveDemo` island as it nears the viewport
  (`client:visible`). The first example's stage mounts at once; later demos,
  the props panel and the code sample mount as they scroll into view
  (`LazyMount`).
- The props panel's controls, the stage family and the code target are
  resolved at build time (`ComponentPageBody.astro`), so a page ships no
  per-id tables. `LiveStage` loads just that family's chunk
  (`stage-loaders.ts`): a button page never downloads charts, media, blocks,
  overlays or layouts.
- The frame, panel and code sample are small static imports; the stage
  router sits behind one dynamic boundary (`LazyLiveStage`, imported only
  lazily). A module imported both ways made the bundler pull an unrelated
  shared chunk (its namespace helper sat in the sheet chunk) into every page,
  and a static router made each page collect every family's CSS.
- Lazily loaded stages carry their styles (`<svelte:options css="injected" />`):
  Astro attaches a lazily imported component's CSS only to some pages, so
  without it component pages lost the stages' own layout styles.
- Measured initial JS (gzip, chromium, 2026-10-23; dev = before this merge,
  merged = after):

| Route | Dev | Merged |
| --- | ---: | ---: |
| `/component-pages/button/` | 67.8 KB | **67.6 KB** |
| `/component-pages/charts-pie/` | 104.4 KB | **77.5 KB** |
| `/gallery-components/` | 130.6 KB | **84.6 KB** |

Button route budget override: `jsGzipKb: 72`, `pageGzipKb: 112` (docs shell + first live demo; `src/components/perf/budgets.ts`).

## A11y (zero exclusions)

Live demos and gallery pass axe WCAG 2.1/2.2 A/AA + best-practice with **no** disabled rules
and **no** excluded selectors. Fixes at source include:

- Nested layout/app-nav demos never emit a second `<main>` inside the docs shell.
- Form fields wire `Field` control props (id / aria-describedby) onto inputs.
- DemoFrame scopes the site theme with its own mode (`data-tx-theme` + `data-tx-mode`
  on the stage), so every token re-scopes and contrast holds when the outer page is
  the opposite scheme.
- Code samples are keyboard-scrollable (`tabindex=0`) without duplicate landmarks.
- Popover content ships an accessible name.

## Identity

| Module | Role |
| --- | --- |
| `LiveDemo.svelte` | Orchestrates frame + stage + props + code |
| `LiveStage.svelte` | Maps catalog id → real component through `stage-map.ts` (20 lazy families, all 125 ids) |
| `DemoFrame.svelte` | Light/dark + LTR/RTL preview chrome |
| `PropsPanel.svelte` | enum → ToggleGroup, boolean → Switch, number/string → Input |
| `LazyMount.svelte` | IntersectionObserver gate for per-route JS |
| `stages/*` | One stage per family: badge, blocks, button, chart, choice, command, data, dialog, feedback, field, layout, media, menu, nav, page-layout, popover, select, sheet, table, toast |
| `PreviewFrame.svelte` | Isolated preview (an iframe of `/gallery-components/preview/`) for layouts that render page landmarks |

`markers.ts` lists every catalog id and the selector that must appear under
`[data-tx-live-stage="{id}"][data-tx-live-ready="true"]` (usually
`[data-tx-live-component="{id}"]` wrapping the real root).

## Validate

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
pnpm build
TEXULI_E2E_PORT=4920 pnpm exec playwright test tests/e2e/site-component-pages.spec.ts
TEXULI_E2E_PORT=4920 pnpm exec playwright test tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts
```

The per-id check (the live stage is ready, its marker is on screen, no request leaves the origin)
runs on desktop Chromium inside the page sweep, `a11y-site`, on the same page loads as its axe in
light and dark. `site-component-pages.spec.ts` checks the props panel, the menu chrome, and
family axe under forced colors; the marker registry covering every catalog id is unit-tested in
`scripts/tests/site-loaders.test.ts`.

- Families load on first need via `@texuli/core/lazy`, one chunk per family.
- Component pages mount layouts inline. The gallery mounts every preview in the isolated preview document, and full-page layouts render inert there with a link to their live document. See [site-gallery-components.md](site-gallery-components.md).
- Inline stages scope the theme on the frame (`data-tx-theme` + `data-tx-mode`). Overlays portal to `body`, so they follow the page's mode; the gallery runs every preview in its isolated document, where overlays follow the card's mode too.
- The props panel offers only the props a stage applies (`stage-controls.ts`). See [site-gallery-components.md](site-gallery-components.md).
