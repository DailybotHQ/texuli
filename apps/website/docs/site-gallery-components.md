# Component gallery

**App:** `apps/website`
**Routes:** `/gallery-components/` and its isolated preview document `/gallery-components/preview/?id=<id>`
**Components:** `src/components/gallery-components/`, with the shared live stages in `src/components/live/`
**Tests:** `tests/e2e/site-live-gallery.spec.ts`, `tests/e2e/site-gallery-components.spec.ts`, `scripts/tests/site-loaders.test.ts`

## Goal

Every catalog component, live. Each of the 127 cards mounts the real Texuli
component with fictional data:
- charts with real series, data blocks, media with a local image;
- overlays that open on click or from the keyboard;
- forms you can type in.

Each card shows its variants and states side by side. It has light/dark and
RTL toggles, a props panel built from the manifest props, and a code sample
that follows the props. Filter the cards by category, tag or search.

## How it works

| Piece | Role |
| --- | --- |
| `buildGalleryComponentCards()` | Build-time cards from the closed manifests: tags, panel `controls`, starting `initial` values |
| `ComponentGallery.svelte` | The island: search, category and tag filters, the card grid (full-width page layouts last) |
| `GalleryPreview.svelte` | A card's demo frame (light/dark, LTR/RTL), its live preview, and "Props and code" |
| `PanelBody.svelte` | The props panel and code sample, loaded on the first open |
| `PreviewApp.svelte` + `pages/gallery-components/preview.astro` | The isolated preview document: one live stage, full page, no site chrome, out of search and the sitemap |
| `live/LiveStage.svelte` | Mounts an id's stage family inline (component pages, and inside each preview document) |
| `live/IsolatedStage.svelte` | A card's preview: the isolated document, following the frame's mode and direction; inert for full-page layouts |
| `live/stage-map.ts` | Every id → its stage family, public import and preview height |
| `live/stage-loaders.ts` | One lazy chunk per family |
| `live/stage-controls.ts` | The props each id's panel offers: the manifest props its stage applies |
| `live/PreviewFrame.svelte`, `live/preview.ts` | The lazy iframe and its same-origin `postMessage` protocol |
| `live/stages/*` | 21 stage families covering all 127 ids |
| `framed` ids (`stage-map.ts`) | Operated in the isolated preview document on their component pages too. The combobox family is framed: its CSS is also server-rendered on the primitives pages, and Astro links the CSS of every lazily reachable stage on each page with a demo, so an inline entry put 1.5 KB gzip on every component page. Only the preview document loads it (`FRAMED_FAMILIES`). |

### Why an isolated preview document

Each preview runs in a same-origin iframe:
- **Theme and direction apply to everything.** Mode and direction are set on
  the preview's `<html>`, so overlays that portal to `body` (dialogs, menus,
  selects, toasts) follow the card's toggle too.
- **Landmarks stay apart.** Layouts render their own `main`, `banner` and
  `navigation`, and they stay inside their document.
- **Layouts behave as in an app.** They meet the frame's real viewport width,
  so the phone and desktop fallbacks work.

The frame keeps its final height from first paint. Its `src` is set only when
the card comes within 200 px of the viewport (an `IntersectionObserver`), so
loading causes no layout shift. After loading, the frame grows to fit its
content, up to 720 px.

### Messages

| From | Type | Content |
| --- | --- | --- |
| Preview → page | `texuli:preview-ready` | `id` |
| Page → preview | `texuli:preview-state` | `id`, `{ values, mode, dir }` |
| Preview → page | `texuli:preview-size` | `id`, `height` |

Both sides accept messages only from the same origin and from the expected
window (the parent or that iframe). `sanitizePreviewValues` keeps only
strings (at most 200 characters), finite numbers and booleans. It drops:
- `href`, `src` and the other URL props;
- `class`, `style` and other markup hooks;
- `on*` handlers;
- arrays and objects.

### Props panel

Panel controls by prop kind:
- an enum becomes a segmented toggle group;
- a boolean becomes a switch;
- a number becomes a number field;
- a string becomes a text input.

The panel offers only the props a stage applies (`STAGE_CONTROLS`). A unit
test keeps every name an editable prop of its manifest and read by its stage
family.

The code sample prints the exact public import and element, for example
`Select.Item` from `texuli/select`. It prints only the props that differ from
their documented default.

## Size

Measured on 2026-10-23 (`pnpm build`, Chromium):
- **HTML:** 849 KB raw, 51 KB gzip, measured with 125 interactive cards
  (about 4.6 KB of markup each). Combobox and multi-select made it 127;
  after them the page weighs 165.9 KB gzip with 86.9 KB of JS.
- **JS on open:** 84.6 KB gzip, down from 130.6 KB on dev before this merge.
  About 50 KB of that is the site chrome every page loads.
- **Preview page:** 66 KB raw, 13 KB gzip (mostly the inlined theme).

Re-measured from `pnpm build` on 2026-10-24 (HTML only; page weight and JS
need the browser spec): the gallery is 833.7 KB raw and 45.4 KB gzip, the
preview page 38.4 KB raw and 8.6 KB gzip.

The route budget in `src/components/perf/budgets.ts` records these numbers
and the reason. `site-perf.spec.ts` measures both routes.

## Validate

```bash
pnpm vitest run scripts/tests/site-loaders.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-live-gallery.spec.ts tests/e2e/site-perf.spec.ts
```

## Limits

- **Abstract content layouts.** `layout-card`, `layout-page`, `layout-doc`,
  `layout-deck` and `layout-grid` are agent tree nodes with no component of
  their own. Their previews use the Texuli parts that render that frame:
  `Card`, `LayoutHost` (`custom`), the docs layout, a paged deck of cards and
  `CardGrid`. The code sample names those parts.
- **The controls test reads per family.** It proves a control is read
  somewhere in its family's stage file. Per-id behavior is covered by the
  browser spec's samples (button, alert, pagination), not by every id.
- **Theme.** Previews use the site theme in light or dark. They do not follow
  a theme picked on `/theme-switcher/`.
- **Full sweeps run on Chromium,** in four parallel chunks of cards (every
  card mounted, axe on the page with its frames, light and dark). WebKit and the Pixel 7 run
  the first chunk. Forced colors is checked on each full-page layout's own
  document, not on every card.
