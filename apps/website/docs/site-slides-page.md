# texuli.com: slides area

**App:** `apps/website`  
**Route:** `/slides-page/` (plus the build-time image `/slides-page/media/texuli-mark.webp`)  
**Components:** `src/components/slides-site/` (the live editors in `slides-site/editor/` are documented in their own area doc)  
**Tests:** `apps/website/tests/site-slides.test.ts` · `tests/e2e/site-slides.spec.ts`

## Goal

Show `@texuli/slides` on the `@texuli/deck` engine (PLAN_008, deck model v2)
as a working product: a real deck to present, editors that write decks in
JSON or Markdown, every layout and background, components on slides, and
print and PPTX export. Both packages are in development and on npm
as 0.6.0 (the v2 stage from 0.4.0; the 0.3.0 release of `@texuli/slides` has the previous model), and
the page says so.

## How it works

| Section | What |
| --- | --- |
| Hero | Eyebrow `@texuli/slides · in development`, the status line and the eight pieces (model, markdown, layouts, backgrounds, engine, stage, components, export) |
| `#deck` | `FlagshipDeck`: the 25-slide fictional `texuli-create-anything` deck on `DeckStage` at the `untrusted` tier. It owns the URL hash (`#/<slide>/<step>`, deep links), and the stage chrome brings fullscreen, the presenter view, blackout, the laser pointer, the help dialog (`?`) and the overview. A keyboard list sits above it (checked against the engine's key bindings) |
| `#editor` | The JSON and Markdown live editors (`slides-site/editor/DeckEditorApp.svelte`, built by the editor lane) |
| `#layouts` | `LayoutsGallery`: one deck with every catalog layout's own sample, and a jump list (label and first "use when") that drives the stage through its controller |
| `#backgrounds` | `BackgroundsGallery`: the 13 presets and one spec of each kind (hex solid, angled gradient, light image, full dark image) under a section-divider slide |
| `#components` | `ComponentsShowcase`: `charts-bar`, `data-grid`, `workflow-graph` (view mode) and `sortable-list` (its list seeded with `$declare`), painted by the stage's default component renderers through the player |
| `#export` | Points to the flagship's export bar: **Download PPTX** (built in the browser by `exportDeckPptx`, imported on first click) and **Print or save as PDF** (opens `?print=1` in a new tab, where the island paints `DeckPrintView` and opens the print dialog) |

Every island is `client:visible`. The galleries build their decks in the
browser, so the page HTML stays small, and they never touch the URL hash
(`syncHash={false}`): only the flagship routes.

### The flagship deck and its media

`slides-site/flagship-source.json` is a verbatim copy of
`packages/deck/decks/texuli-create-anything.json`: the deck package exports
no `decks` subpath, and packages never deep-import each other's files. The
unit test fails when the copy and the original differ.

`flagshipDeck()` adapts the copy without rewriting it:

- the sample's `https://example.com/media/diagram.webp` images become
  `media/texuli-mark.webp`, with alt text that describes the mark. Deck media
  accepts relative paths without `..` or a leading `/`, so the image is
  served under `/slides-page/` by a static endpoint
  (`pages/slides-page/media/texuli-mark.webp.ts`) that copies the brand
  isotype at build time. The page requests nothing from another origin;
- the three video slides are `hidden`: the site ships no video file. Hidden
  slides stay in the model, print and PPTX, but not in the presentation.

The layout gallery uses the same image. Its three video layouts point at a
same-origin clip path with no file behind it, so their players show their
unavailable state.

## Security and accessibility

- Every deck renders at the `untrusted` tier: media and links go through the
  URL policy at paint, and text is text (no `{@html}`, `set:html` or
  `innerHTML`). The unit test checks the page sources for sinks and for
  non-example.com URLs.
- No inline handlers: Svelte attaches listeners, and the build-time CSP
  hashes the islands.
- Keyboard-complete: the stage keys, the jump lists (buttons with
  `aria-current`), and the export buttons. Targets are at least 44 px.
- Light, dark and forced colors use `--tx-*` tokens with system-color
  fallbacks. Layouts reflow at 360 px (the canvas scales and the jump
  lists scroll).

## Tests

- `apps/website/tests/site-slides.test.ts` (happy-dom): honest copy, no
  sinks, example.com only, lazy islands and section anchors, keys that the
  engine binds, the flagship copy equal to `@texuli/deck`'s deck, the adapted
  flagship (validates, 25 slides, video slides hidden, only same-origin
  media), the gallery decks validating with one slide per entry, the
  components deck painting without diagnostics, a jump-list click moving
  its stage, and the flagship island's stage and export bar.
- `tests/e2e/site-slides.spec.ts` (2 tests, one page session each):
  - the flagship's keyboard steps with the hash following, the help dialog,
    blackout, a deep link, the layout jump list (the hash untouched), the
    data grid painted on a slide, axe in light and dark, and no foreign
    requests;
  - the editors: the JSON seed paints, invalid JSON is refused with a
    located diagnostic and the preview cleared, and a typed Markdown deck
    paints; axe; no foreign requests.

## Navigation

The sidebar entry (`Slides`, Components group) and the docs shell section
are unchanged. Search, `llms.txt` and the route budget are registered by the
integration step (`T-site-integration`).
