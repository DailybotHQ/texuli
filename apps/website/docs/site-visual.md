# Visual polish

**App:** `apps/website`
**Spec:** `tests/e2e/site-visual.spec.ts`

## Goal

Every route reads as finished, in light and dark, on desktop and the Pixel 7:
- no horizontal overflow and no clipped or off-center panels;
- no stand-ins left after load, and no broken images;
- dark mode as deliberate as light.

A screenshot review of every route family found the issues below. The spec keeps them fixed.

## What the spec checks

**Every built page** (sitemap plus the 404), in light and dark. The per-page check runs in the page sweep, `tests/e2e/a11y-site.spec.ts`, on the same page loads as axe (primitive pages: `site-live-primitives.spec.ts`, with the demo mounted). Chromium and the Pixel 7 walk every page; WebKit walks one page per route group.

| Check | Fails when |
| --- | --- |
| Page overflow | `scrollWidth` of the document exceeds the viewport |
| Escaping elements | A visible element extends past the viewport and no ancestor scrolls or clips it (an off-center or clipped panel) |
| Stand-ins | Copy such as "Loading demo…", "coming soon", "lorem ipsum" or "TODO" is still on screen after the page settles |
| Broken images | A rendered `<img>` has no pixels |
| Illustration fallbacks | A slot without artwork lacks its texel mosaic |

**Targeted checks** (`tests/e2e/site-visual.spec.ts`):
- **Theme swatches:** the switcher and the theme gallery paint the palette of the active mode (dark when the site is dark).
- **Inline code** keeps the spaces around it (the guides).
- **Demo frames** fit their column on a phone.
- **Geo maps and heatmaps** paint a color scale, not one flat fill.

```bash
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-site.spec.ts tests/e2e/site-visual.spec.ts
```

## What the review found, and the fixes

| Finding | Where | Fix |
| --- | --- | --- |
| Live demos wider than the phone column (button, badge, chip, tag, toaster, icon button) | `live/LiveDemo.svelte`, `live/DemoFrame.svelte`, `live/PropsPanel.svelte` | `minmax(0, 1fr)` grid columns. The stage scrolls instead of growing. A `fieldset` no longer keeps its min-content width. Enum toggles wrap. |
| Chart family pages up to 553 px wide on a 412 px phone | `charts-page/ChartFamilyFrame.astro`, `pages/charts-page/index.astro`, `charts-page/demos/InteractionDemo.svelte` | `minmax(0, 1fr)` columns |
| Charts pushed 40 px right | `@texuli/charts` `CartesianChart`, `MatrixFrame` | Reset the browser's default `figure` margin |
| Interaction plot fixed at 480 px | `@texuli/charts` `InteractivePlot` | The SVG scales down (aspect ratio). Pointer positions convert back to plot units, so hover and brush stay exact. |
| Choropleth tiles black (light) and white (dark); heatmap one flat color | `@texuli/charts` geo and matrix | Themes without a sequential palette get a ramp mixed from the first chart color (or primary) into the background (`math/color.ts`) |
| Composition canvas 840 px wide on a phone | `@texuli/media` `CompositionCanvas` | The figure's column can shrink; the canvas scales |
| Toolbar wider than the screen | `texuli` toolbar CSS | Horizontal toolbars wrap within their container |
| Pager titles (`DropdownMenu.Content`) overflowing | `docs/DocsPager.astro` | The link can shrink; the title breaks |
| Paths breaking mid-word (`@texuli/primitives/accord‑ion`) | `pages/primitives-page/*` | `<wbr>` after each slash; `overflow-wrap: break-word` |
| Missing spaces around inline code ("uses`enterprise-neutral`") | Guides and other `.astro` prose | HTML compression drops a line-break space before an inline tag; the tag now shares the line with its text |
| Theme swatches showing the light palette when the site is dark | Theme switcher, theme gallery, color explorer | `system` resolves to the painted mode; the switcher catalog carries each theme's dark swatches |
| Component pages with unstyled demos (media image, split view, blocks: plain text instead of the styled component) | `astro.config.mjs` | Library CSS (any `.tx-` rule) is never inlined (`inlineSiteCss`). When Astro inlined a stylesheet, it stopped linking it on pages that reach it only through a lazily loaded stage. Site-owned CSS under 5 KB is still inlined (larger site CSS would push the largest pages over their HTML budgets). |
| Content clipped by the screen edge in docs pages on a phone | `docs-shell/DocsShell.astro` | No negative inline margin, so the page gutter stays |
| Performance table and the evidence date wrapping badly | `pages/perf/index.astro`, `pages/evidence/index.astro` | The table scrolls inside its region at a minimum width; the date stays on one line |
| Illustration fallback looked like a failed image (a blurred gradient) | `landing/SiteIllustration.astro` | A texel mosaic in theme tones, seeded by the slot name: intentional until the artwork exists, with outlines in forced colors |

## Page weight

Stylesheets as files cost more than inlined ones (each file compresses alone): keeping every stylesheet a file cost 3 to 5 KB gzip per page, so only library CSS stays a file. The changes that keep every route within its budget (no budget was raised):
- **Dark swatches load only in dark.** The switcher fetches `theme-catalog-dark.json` (each theme's dark swatches) only when the site paints dark. The light catalog stays as it was.
- **The gallery preview document loads one stage family.** `PreviewApp` imports the stage through `live/LazyLiveStage.svelte`, so it no longer links every family's CSS.
- **Stages, the demo frame and the preview frame carry their own styles** (`css="injected"`). Their CSS loads with their chunk; the frame's CSS ships once instead of once per chunk; pages without a preview no longer link the preview frame's CSS.
- **Contrast ratios at display precision.** The theme gallery's cards print ratios to one decimal; storing them that way cut `/theme-gallery.json` by 4 KB gzip without changing a printed value.
- **No unused fields in the switcher.** `darkFirst` and `contrastLevel` left the switcher rows; the first rows no longer carry dark swatches in the HTML (they come from the dark catalog, like the rest).
- **The combobox family is framed** (see `site-gallery-components.md`), so its CSS stays off every other component page.

Measured on 2026-10-23 after merging dev (Chromium, every same-origin file, gzip KB, page / JS):
- `/`: 150.6 / 113.3 (budget 152 / 116);
- `/blocks-page/`: 95.8 / 54.1 (96 / 64);
- `/component-pages/charts-pie/`: 117.3 / 78.9 (120 / 80);
- `/theme-switcher/`: 99.5 / 58.1 (100 / 64);
- `/color-explorer/`: 109.8 / 61.1 (112 / 64), HTML 301.1 KB raw (304);
- `/charts-page/`: HTML 27.5 KB gzip (28).

## Limits

- **Visual design quality** beyond these checks is reviewed by eye, from screenshots. The spec catches regressions of the found classes, not taste.
- **Sampling on WebKit:** one page per route group.
- **The escaping-element check** ignores fixed elements and anything inside a scroll container. A panel clipped inside its own scroller can still need a screenshot to spot.
- **Library CSS of other stage families** still loads on component pages (about 4 KB gzip: chart families, composition canvas, data blocks). Astro links a lazily reachable module's CSS on every page with a demo when that CSS is also server-rendered elsewhere on the site (the chart, media and blocks pages). `/blocks-page/` sits 0.2 KB under its page budget, `/theme-switcher/` 0.5 KB. Trimming the stage router's preload list (2 KB gzip) is not possible from the site config: Astro sets the client build's `modulePreload` itself.
