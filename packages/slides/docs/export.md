# Print, PDF and PPTX export

**Import:** `@texuli/slides/export` (the main functions are also re-exported
from `@texuli/slides`)  
**Source:** `packages/slides/src/export/`  
**Tests:** `tests/export.test.ts` (model v1: print plan, PDF seam, PPTX),
`tests/export-v2.test.ts` (model v2: print plan and flags, PPTX),
`tests/stage-content.test.ts` (v1 `DeckPrint`), `tests/e2e/slides-print.spec.ts`
(v2 `DeckPrintView` to PDF in Chromium)

Export of a validated deck. Nothing here uploads anything, and the PPTX
writers never fetch.

> **Status: in development.** The model v2 export described here (the
> `@texuli/deck` model, `DeckPrintView`, the v2 PPTX writer) lands with the
> next minor, `0.4.0`, which is **not on npm yet**. The published `0.3.0`
> has the model v1 export only (`planDeckPrint`, `DeckPrint`, the v1 PPTX
> writer). See [RELEASE](../../../docs/RELEASE.md).

Both deck models are accepted. A deck with `formatVersion: 2` (a validated
`@texuli/deck` model v2 deck, `prepareDeck(input).deck`) takes the v2 paths;
any other deck is a model v1 deck ([model.md](model.md)) and takes the v1
paths, unchanged for their callers.

## Export geometry

A v2 slide is painted on a fixed virtual canvas per aspect. The print page,
the PPTX slide and the stage canvas are the same size, so a slide never
rescales between them.

- `DeckExportAspect` is `16:9`, `4:3`, `9:16` or `1:1`.
- `DECK_EXPORT_CANVAS` maps each aspect to its canvas in CSS pixels:
  1280 × 720, 1024 × 768, 720 × 1280 and 1080 × 1080.
- `PPTX_CANVAS_SLIDE_SIZES` maps each aspect to the PPTX slide size in EMU:
  the canvas at 96 pixels per inch (9525 EMU per pixel).
- `DECK_PRINT_CANVAS_PAGE_SIZES` maps each aspect to its print page: exactly
  the canvas, with a named page `tx-deck-canvas-16-9` (and so on) that
  `DeckPrintView` declares.

## Print and PDF

The PDF path is the browser's own print dialog ("Save as PDF"). Texuli does
not generate PDF bytes.

### The print plan

`planDeckPrint(deck, { notes })` returns a `DeckPrintPlan` and does not
change the deck. `DeckPrintOptions.notes` is a `DeckPrintNotes` value from
`DECK_PRINT_NOTES`:

- `none` (default): slides only;
- `appendix`: slides, then a notes section (one notes page per slide);
- `handout`: titles and notes only.

The plan lists its pages (`DeckPrintPage`: slide or notes pages, each with
the slide id, its index in `deck.slides` and a label), a sanitized
`filename`, and a page size (`DeckPrintPageSize`):

- **v2 decks:** one page per **visible** slide (slides with `hidden: true`
  are skipped), sized from `DECK_PRINT_CANVAS_PAGE_SIZES` by the deck's
  `style.aspect` (16:9 when absent). A page is labelled with
  `deckSlideLabel(slide)`: `slide.title`, else the layout's own `title` prop
  (layouts without one, such as `free`, `quote` or `big-stat`, give
  `undefined`), else `Slide n`.
- **v1 decks:** one page per slide, sized from `DECK_PRINT_PAGE_SIZES`: 16:9
  is 13.333in × 7.5in, 4:3 is 10in × 7.5in, and 1:1 is 7.5in × 7.5in, each
  tied to a named `@page` in [styles.md](styles.md).

`deckExportFilename(title, extension)` turns a title into a safe download
name: no path separators or control characters, an 80-character stem, and
`presentation` as the fallback.

### The print route flags

A deck route prints when its URL asks for it:

- `parseDeckPrintFlags(search)` reads `?print=1&notes=1` into
  `DeckPrintFlags` (`print`, `notes`). Only the value `1` counts; `notes=1`
  means the `appendix`. `handout` stays API-only.
- `deckPrintSearch({ notes })` writes the search string back: `?print=1` or
  `?print=1&notes=1`.

### DeckPrintView (model v2)

`DeckPrintView` renders a v2 deck for print. Its props are
`DeckPrintViewProps`:

| Prop | Default | Meaning |
| --- | --- | --- |
| `deck` | required | A validated v2 deck. |
| `notes` | `none` | `none`, `appendix` or `handout`. |
| `slide` (v1 name `children`) | — | A snippet `(slide, index)` that paints each slide instead of the default renderers. |
| `renderers` | — | Extra renderer tables ahead of the default layouts and component registry. |
| `tier` | `untrusted` | URL policy tier for media and links; keep `untrusted` for agent decks. |
| `messages`, `resolveAvatar` | — | As on the stage ([stage.md](stage.md)). |
| `loadTheme` | the library loader | Catalog theme loader; `null` when the host loads theme CSS itself. |
| `contentReady` | `true` | Hosts keep it `false` until their own content (chart snapshots, fonts) is ready. |
| `onReady(plan)`, `onError(error)` | — | Readiness and load failures. |
| `mediaTimeoutMs` | `10000` | Longest wait for renderers and images before reporting ready anyway. |
| `isolate` | `true` | While printing, hide the rest of the host page and its margins so page 1 is slide 1. Turn it off when the host prints its own frame. |

What it prints:

- one page per visible slide at the canvas size of the deck aspect (a named
  `@page` with no margin: 1280 × 720 CSS pixels for 16:9), hidden slides
  skipped;
- each slide painted by the stage's own slide preview (the 20 catalog
  layouts, free slides, the component registry, backgrounds and per-slide
  themes), loaded on first use. A theme with mode `system` or none prints
  light; explicit `dark` and `high-contrast` modes hold. Motion is off;
- reveal steps flattened: each slide prints once, at its last step, with
  every fragment shown. There are no per-step pages;
- with `appendix`, a notes section after the slides; with `handout`, the
  notes pages only. A slide without notes says so.

**Readiness gate.** The root carries `data-print-ready="false"` (and
`aria-busy`) until nothing under it is still loading (lazy layouts,
component families, slide previews, code tokenizing), every image has loaded
or failed (images are switched to eager loading), fonts are settled, and
`contentReady` is true. It then sets `data-print-ready="true"` and calls
`onReady(plan)`. After `mediaTimeoutMs` it reports ready anyway, so a print
never hangs on one broken image. A host or a headless browser waits on that
attribute before it prints.

`DeckPrintView` is a thin wrapper that imports its body on first use, so
importing `@texuli/slides/export` for PPTX or the print plan costs no print
code.

```svelte
<script lang="ts">
  import { DeckPrintView, parseDeckPrintFlags, requestDeckPdf } from '@texuli/slides/export';

  let { deck } = $props();
  const flags = parseDeckPrintFlags(location.search);
</script>

{#if flags.print}
  <DeckPrintView {deck} notes={flags.notes} onReady={(plan) => requestDeckPdf(plan)} />
{/if}
```

### DeckPrint (model v1)

`DeckPrint` ([stage.md](stage.md)) renders the planned pages of a v1 deck
and reports when they are ready to print. Printed slides use the same slot
layout as the stage
([model.md](model.md#composition-slots-and-media-regions)), with reveal
steps flattened the same way.

```svelte
<DeckStage {deck} />
<DeckPrint {deck} notes="appendix" printOnly onReady={(plan) => (printPlan = plan)} />
<button disabled={!printPlan} onclick={() => printPlan && requestDeckPdf(printPlan)}>
  Export PDF
</button>
```

### The PDF seam

`requestDeckPdf(plan, options)` takes `DeckPdfRequestOptions` (`exporter`,
`print`). Without an exporter it opens browser print and resolves a
`DeckPdfResult` of `{ method: 'browser-print', filename }` once the dialog
was requested; it cannot know whether the user saved. With a host
`DeckPdfExporter(plan)`, for example a tool-side renderer, the returned Blob
must be a non-empty `application/pdf`, or the call rejects. Without a print
function or an exporter, it fails with a clear error.

### What is tested

Unit tests cover both plans, the route flags, labels, filenames, exporter
checks and the page-size/CSS sync. For v2, a Chromium browser test mounts
`DeckPrintView` in the fixture app, waits for `data-print-ready`, and checks
that `page.pdf()` gives one page per visible slide at the canvas size of each
aspect, then the notes appendix. Other browsers' print engines are not
tested; named pages need a browser that supports the CSS `page` property,
and others print at their default size.

Planned: a tool-side multi-page PDF exporter, a stills zip, deck video and
optional per-step pages.

## PowerPoint (PPTX)

```ts
import { exportDeckPptx } from '@texuli/slides/export';

// Model v1: synchronous.
const { filename, blob, omitted } = exportDeckPptx(v1Deck, { notes: true });

// Model v2: a promise (the v2 writer loads on first use).
const v2 = await exportDeckPptx(v2Deck, {
  loadImage: async (src, context) => hostImageBytes(src, context), // host-defined
  snapshotChart: async (chart, context) => hostChartPng(chart, context), // host-defined
});
// The host offers `blob` as a download named `filename`.
```

Three entry points, each for either model:

- `exportDeckPptx` returns a Blob of type `PPTX_MIME_TYPE` (v2:
  `DeckPptxV2Export`);
- `writeDeckPptx` returns the bytes;
- `buildDeckPptx` returns the XML parts unzipped, as a `DeckPptxPackage` of
  `DeckPptxPart` entries (v2: a `DeckPptxV2Package` with its parts, embedded
  media and omissions), for inspection or another packager.

For a v1 deck they are synchronous. For a v2 deck they return promises:
the v2 writer is a separate chunk that `loadDeckPptxWriter()` imports (once);
hosts may call it early to warm the chunk. `DeckPptxOptions` is the options
type of either writer (the v1 writer reads only `notes`), and
`DeckPptxOmission` is either omission shape.

Output is deterministic for both: the same deck (and, for v2, the same host
answers) gives the same bytes. Tests unzip the output and parse every part.

### Model v2 writer

`DeckPptxV2Options`:

| Option | Default | Meaning |
| --- | --- | --- |
| `notes` | `true` | Write speaker notes pages. |
| `loadImage(src, context)` | — | Resolve an image source to bytes (`DeckPptxImageAsset`). Without it, images are omitted. |
| `snapshotChart(chart, context)` | — | Rasterize a chart block to a picture. Without it, charts are omitted and their title stays. |
| `palette` | the embedded theme, else neutral | The resolved theme palette (`#rrggbb` per role), or a function of each slide (`undefined` for the deck theme). |
| `fonts` | — | `heading`, `body` and `mono` families; the first concrete family of a CSS list is used. |
| `noteOmissions` | `true` | Also list each slide's omissions on its notes page (needs `notes`). |
| `hidden` | `include` | `include` writes hidden slides as PowerPoint hidden slides; `skip` leaves them out. |

What the file holds:

- **Layouts and placeholders.** One slide master and one slide layout per
  deck layout (the 20 catalog layouts and `free`; component and custom
  slides use `free`), with title, body and picture placeholders. Slide text
  goes into those placeholders, so PowerPoint's outline view lists every
  slide title (`slide.title`, else the layout's `title` prop). Layouts map to
  an OOXML layout type where one fits (`title-hero` is `title`,
  `section-divider` is `secHead`, `two-column-split` is `twoObj`, the image
  layouts are `picTx`); the rest are custom.
- **Slides** at the canvas size (`PPTX_CANVAS_SLIDE_SIZES`), with every
  reveal step shown in its final state.
- **Text** in placeholders and shapes, with the deck locale and direction
  on every run; free slides write their blocks (headings, text, lists,
  quotes, callouts, code in the mono face, nested columns) in reading order.
- **Tables** as native `a:tbl` tables, from `comparison-table` slides and
  table blocks.
- **Pictures** from host bytes. `loadImage` receives the source as authored
  and a `DeckPptxAssetContext` (`slideId`, the JSON `path`, and `kind`:
  `image`, `avatar`, `background` or `poster`); the host applies its URL
  policy, fetches and returns bytes, or nothing to leave the image out.
  Returned bytes must be PNG, JPEG, GIF or BMP, and their leading bytes must
  match the declared `mimeType`; one image may be at most 25 MiB and one file
  at most 200 MiB of media. Anything else, and a callback that throws, is
  omitted and never embedded. The intrinsic size comes from the asset, else
  from the image header, and pictures keep their proportions (contained or
  cropped to cover). The same source is embedded once.
- **Charts** as pictures. `snapshotChart` receives the chart block and a
  `DeckPptxChartContext` (`slideId`, `path`, and the picture frame `width`
  and `height` in canvas pixels, to render at that size or a multiple).
- **Theme** colors and fonts from the resolved palette and `fonts`.
- **Backgrounds** per slide: solid, gradient, pattern and image (through
  `loadImage`), with the contrast scrim; a video background uses its poster.
- **Notes** pages with the slide's speaker notes, plus its omissions unless
  `noteOmissions` is false.
- **Hidden slides** (`hidden: true`) as PowerPoint hidden slides
  (`show="0"`: in the file, skipped in the slide show), or left out with
  `hidden: 'skip'`.
- The deck title, description and language in the document properties.

**The `omitted` report.** Everything the writer cannot map is listed in
`omitted` as a `DeckPptxV2Omission` (`slideId`, `kind`, `path`, `reason`).
`DeckPptxOmissionKind` is `image`, `chart`, `video`, `component`, `custom`,
`background`, `block` or `link`. Only dividers and blocks nested more than
eight containers deep are skipped without a report.

**Not supported yet:**

- animations and slide transitions (steps are flattened, transitions are
  not written);
- editable charts (charts are pictures from the host snapshot, or omitted);
- video and audio (a video layout shows a labelled frame; video, audio,
  gallery and embed blocks are omitted);
- interactive components (component slides and component blocks keep their
  title and are reported) and host-painted custom slides;
- clickable links (a call-to-action target is written as text and
  reported, so no URL becomes a hyperlink);
- slide numbers, footers and logos.

### Model v1 writer

`DeckPptxOptions.notes` (default `true`) writes speaker notes pages.

- **What it writes:** one slide per deck slide, sized by `PPTX_SLIDE_SIZES`
  from the aspect, with:
  - a title text box;
  - a content text box: headings in bold, list items as bullets, code in a
    monospace face, and other text-bearing blocks as their `blockText` lines;
  - notes pages;
  - the deck title, description and language in the document properties.

  Runs carry the deck locale. Reveal steps are flattened to the final state:
  every block and list item is written, with no PowerPoint animations, and a
  `strike` or `highlight` emphasis is not styled.
- **What it leaves out:** media blocks and charts are not embedded, and blocks
  with no text form (table, stat, kpi, poll, quiz, calculator, checklist) have
  nothing to write. Each is reported in `omitted` (`slideId`, `blockType`,
  `path`). Dividers and column containers are skipped silently.
- **Not mapped:** hyperlinks and CTA targets (only labels export, so no URL
  reaches the file), rich text styling, deck token themes (a fixed neutral
  Office theme is used), slide masters and their slots as layouts (slot
  blocks write in reading order into the one content box), title
  placeholders (so PowerPoint's outline view does not list titles),
  transitions, and reveal steps as animations. The v2 writer covers several
  of these for v2 decks.

### Compatibility

The output of either writer has not been opened in PowerPoint, Keynote or
LibreOffice, or validated against the OOXML schemas, in this repository.
Treat compatibility as unverified until that check exists. Tests check that
every part parses as XML, that every content-type override and relationship
target resolves, that hostile text stays text, and that the ZIP reads back
with matching CRCs.

## XML and ZIP writers

The PPTX parts come from an in-package XML writer with no raw-markup API:

- `el(name, attributes, ...children)` builds an `XmlElement`; string children
  become escaped `XmlText` (`xmlText`). `XmlNode`, `XmlChild` and
  `XmlAttributeValue` type the tree.
- `serializeXml(root)` writes the document. Element and attribute names are
  checked when a node is built and again when it is written, so a hand-made
  node cannot inject markup.
- `escapeXmlText` and `escapeXmlAttribute` escape values;
  `sanitizeXmlChars` drops characters XML 1.0 cannot carry.

`writeZip(entries)` writes a deterministic stored (uncompressed) ZIP from
`ZipEntry` items, with `crc32` checksums. It refuses absolute, `..`,
backslash, empty-segment, control-character and duplicate paths. ZIP64 is not
supported.
