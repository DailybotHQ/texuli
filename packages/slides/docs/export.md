# Print, PDF and PPTX export

**Import:** `@texuli/slides/export` (the main functions are also re-exported
from `@texuli/slides`)  
**Source:** `packages/slides/src/export/`  
**Tests:** `tests/export.test.ts` (print plan, PDF seam, PPTX), `tests/stage-content.test.ts` (DeckPrint)

Framework-free export of a validated deck. Nothing here uploads anything.

## Print and PDF

The PDF path is the browser's own print dialog ("Save as PDF"). Texuli does
not generate PDF bytes.

- `planDeckPrint(deck, { notes })` returns a `DeckPrintPlan` and does not
  change the deck. `DeckPrintOptions.notes` is a `DeckPrintNotes` value from
  `DECK_PRINT_NOTES`:
  - `none` (default): slides only;
  - `appendix`: slides, then a notes section;
  - `handout`: titles and notes only.

  The plan lists its pages (`DeckPrintPage`: slide or notes pages), a
  sanitized `filename`, and a page size (`DeckPrintPageSize`) from
  `DECK_PRINT_PAGE_SIZES`: 16:9 is 13.333in × 7.5in, 4:3 is 10in × 7.5in, and
  1:1 is 7.5in × 7.5in, each tied to a named `@page` in
  [styles.md](styles.md).
- `deckExportFilename(title, extension)` turns a title into a safe download
  name: no path separators or control characters, an 80-character stem, and
  `presentation` as the fallback.
- `requestDeckPdf(plan, options)` is the export seam, with
  `DeckPdfRequestOptions` (`exporter`, `print`). Without an exporter it opens
  browser print and resolves a `DeckPdfResult` of `{ method: 'browser-print',
  filename }` once the dialog was requested; it cannot know whether the user
  saved. With a host `DeckPdfExporter(plan)`, for example a tool-side
  renderer, the returned Blob must be a non-empty `application/pdf`, or the
  call rejects. Without a print function or an exporter, it fails with a
  clear error.

`DeckPrint` ([stage.md](stage.md)) renders the planned pages and reports when
they are ready to print.

Printed slides use the same slot layout as the stage
([model.md](model.md#composition-slots-and-media-regions)). Reveal steps are flattened: each slide prints once, in its final state, with
every fragment and list item shown, emphasis on, and code at its last
highlight step. There are no per-step pages.

```svelte
<DeckStage {deck} />
<DeckPrint {deck} notes="appendix" printOnly onReady={(plan) => (printPlan = plan)} />
<button disabled={!printPlan} onclick={() => printPlan && requestDeckPdf(printPlan)}>
  Export PDF
</button>
```

Unit tests cover the plan, filenames, exporter checks and the page-size/CSS
sync. Real print-engine pagination and named-page sizing have no automated
browser test yet. Named pages need a browser that supports the CSS `page`
property; others print at their default size.

Planned: a tool-side multi-page PDF exporter, a stills zip, deck video and
optional per-step pages.

## PowerPoint (PPTX)

```ts
import { exportDeckPptx } from '@texuli/slides/export';

const { filename, blob, omitted } = exportDeckPptx(deck, { notes: true });
// The host offers `blob` as a download named `filename`.
```

`exportDeckPptx` returns a Blob of type `PPTX_MIME_TYPE`. `writeDeckPptx`
returns the bytes. `buildDeckPptx` returns the XML parts unzipped, as a
`DeckPptxPackage` of `DeckPptxPart` entries, for inspection or another
packager. `DeckPptxOptions.notes` (default `true`) writes speaker notes pages.
Output is deterministic: the same deck gives the same bytes.

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
  nothing to write. Each is reported in `omitted` as a `DeckPptxOmission`
  (`slideId`, `blockType`, `path`). Dividers and column containers are
  skipped silently.
- **Not mapped yet:** hyperlinks and CTA targets (only labels export, so no URL
  reaches the file), rich text styling, deck token themes (a fixed neutral
  Office theme is used), slide masters and their slots as layouts (slot blocks write in reading
  order into the one content box), title placeholders (so
  PowerPoint's outline view does not list titles), transitions, and reveal
  steps as animations.

The output has not been opened in PowerPoint, Keynote or LibreOffice, or
validated against the OOXML schemas, in this repository. Treat compatibility
as unverified until that check exists. Tests check that every part parses as
XML, that every content-type override and relationship target resolves, that
hostile text stays text, and that the ZIP reads back with matching CRCs.

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
