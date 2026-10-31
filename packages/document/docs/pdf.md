# `@texuli/document/pdf`

The owned PDF writer (ADR-016): a PDF 1.7 file drawn from the paged layout
of `@texuli/document/paged`, measured with font metrics. Load it lazily
(`await import('@texuli/document/pdf')`, as `@texuli/pages/export` does).

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```ts
import { PDF_MIME, writePdf } from '@texuli/document/pdf';

const { bytes, pageCount, diagnostics } = await writePdf(doc, {
  resolveImage: (ref) => imageBytes.get(ref),
  font: notoSansTtf, // optional: text outside WinAnsi
});
const file = new Blob([bytes], { type: PDF_MIME });
```

## What it writes

`writePdf(doc, options)` returns a `PdfResult`: the file `bytes`, the
`pageCount`, the `layout` it was drawn from, and the `diagnostics`
(`OutputDiagnostic`).

- **Text** is set in the standard 14 fonts (Helvetica in four styles for
  text, Courier for code) with WinAnsi encoding and the Adobe metrics, and
  wrapped greedily at word boundaries (long words break between
  characters). Headings are larger and bold, quotes muted with a bar,
  callouts shaded with a toned bar and a bold title, code shaded and
  monospaced, lists marked (`•`, `1.`, `[x]`, `[ ]`), wrapped tables drawn
  with rules and a bold header row (they split between rows), columns
  side by side, dividers as rules.
- **Pages** come from the paged layout: explicit breaks, headings kept with
  what follows, widows and orphans, and headers and footers with page
  numbers.
- **Links** are link annotations over their text, underlined.
- **Images**: JPEG passes through (`DCTDecode`); PNG passes through with
  the PNG predictor for grayscale, RGB and palette images, and 8-bit PNGs
  with alpha are decoded through the platform `DecompressionStream` and
  written with a soft mask (at most `MAX_IMAGE_PIXELS_BYTES`, 64 MiB of
  pixels). Interlaced PNGs and other formats print the alt text, with an
  `image-unsupported` diagnostic. Images scale to the content width and
  never outgrow a page.
- **A host font**: `font` takes TrueType bytes (`.ttf`, at most
  `MAX_FONT_BYTES`, 16 MiB); characters outside WinAnsi are set in it,
  embedded whole as a CID font with a `ToUnicode` map so text stays
  searchable and copyable. `parseTrueType(bytes)` is the bounded reader it
  uses (a `TrueTypeFont`, or `null` for CFF-flavored OpenType, collections
  and malformed files). Without a font such characters print as `?` with
  one `glyph-missing` diagnostic. Font subsetting is planned.
- Embeds and wrapped blocks other than tables print their text, with a
  diagnostic; annotations are dropped. `probeImage`, `ImageInfo` and
  `ImageResolver` are re-exported from the shared output module, with
  `MAX_IMAGE_BYTES` and the `OutputDiagnosticCode` union.

`PdfOptions`: `page` (settings merged over the document's), `resolveImage`,
`trust` (`untrusted` by default), `pageHref`, `pageNumbers`, `font`,
`fontSize` (body size in points, 8 to 18, default 11) and `compress`
(deflate content streams where the platform has `CompressionStream`,
default true). `PDF_MIME` is `application/pdf`.

## Design systems

`design` takes plain design values, a `DocumentDesign`: `colors` as
`#rrggbb` per `DocumentDesignRole` and `fonts.sans`, `fonts.heading` and
`fonts.mono` as CSS stacks. Build them from a compiled design system with
`designValues(compiled, mode)` from `@texuli/tools/print` (or pass
`designSystem` to `renderBlueprintPdf`); the document engine never
imports `@texuli/tokens`. The writer reads:

| Role | Where |
| --- | --- |
| `foreground` | Text and table header rules |
| `mutedForeground` | Captions, quotes, embeds, the header and footer |
| `link` | Link text and underline |
| `border` | Rules: dividers, quote bars, table lines |
| `muted` | The code background |
| `muted`/`borderStrong`, `primarySoft`/`primary`, `infoSoft`/`info`, `successSoft`/`success`, `warningSoft`/`warning`, `destructiveSoft`/`destructive` | The fill and bar of the neutral, accent, info, success, warning and danger callouts |
| `background` | A full-page fill, only when it is not white (a dark design) |
| `fonts.sans` | A serif stack (its first known serif family or `serif` comes before a sans one) sets the text in Times (Roman, Bold, Italic, BoldItalic), whose metrics load in a lazy chunk; any other stack stays Helvetica. Code stays Courier, and headings use the body family |

A color outside `#rrggbb` is ignored, so hand-built or hostile values
fall back to the defaults. Without `design` (or with an empty one) the
bytes are exactly the default output (a test pins their SHA-256). The
brand's own font files are not embedded from the design: pass TrueType
bytes as `font` for that (planned: a design-driven font embedding).

## Security

- Every string in the file (text, the title and author, URIs, the language)
  is a hex string, so content can never close a string or inject an
  operator or a dictionary key.
- No JavaScript, forms, launch actions, open actions or embedded files: the
  only actions are `URI` actions on link annotations.
- Links pass `safeHref` at the tier and must be absolute; a refused link
  keeps its text and reports `link-refused`. Image refs pass `safeImageSrc`
  before the host is asked for their bytes.
- Fonts and images are parsed with bounds checks and caps; anything
  malformed is refused with a diagnostic, never thrown.
- Output is deterministic: no dates, no random ids.

## Not yet

Right-to-left and complex-script shaping (text is laid out left to right,
one glyph per character), tagged PDF and bookmarks for headings, font
subsetting, and PDF/A are planned. The paged view prints through the
browser, which handles every script.
