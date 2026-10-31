# `@texuli/document/docx`

The owned DOCX writer (ADR-016): WordprocessingML for a validated document,
built on the escaped `@texuli/core/markup` builders and zipped with
`@texuli/core/zip`. Load it lazily (`await import('@texuli/document/docx')`,
as `@texuli/pages/export` does): only an export pays for it.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```ts
import { DOCX_MIME, writeDocx } from '@texuli/document/docx';

const { bytes, diagnostics } = await writeDocx(doc, {
  resolveImage: async (ref) => new Uint8Array(await (await fetch(ref)).arrayBuffer()),
});
const file = new Blob([bytes], { type: DOCX_MIME });
```

## What it writes

`writeDocx(doc, options)` returns a `DocxResult`: the package `bytes` and
the `diagnostics` (`OutputDiagnostic`: an `OutputDiagnosticCode`, the block
`id` when there is one, and a message). The package holds
`[Content_Types].xml`, the package and document relationships,
`docProps/core.xml` (title, description, authors, language, dates) and
`app.xml`, `word/document.xml`, `styles.xml`, `numbering.xml`, a header and
a footer part when the page has them, and `word/media/` images.

| Document | DOCX |
| --- | --- |
| Heading 1 to 4 | `Heading1`…`Heading4` styles (outline levels, kept with next) |
| Paragraph runs | Bold, italic, strike, inline code (Consolas, shaded), line breaks |
| Links | Hyperlinks through external relationships (see Security) |
| Lists | Numbering definitions: bullets, decimal (restarting at `start`), todo items as ☐/☑, nested levels |
| Quote | An indented block |
| Callout | Shaded paragraphs with a toned start border and a bold title |
| Code | The `Code` style, newlines as breaks, tabs as tabs |
| Divider | A bottom border |
| Toggle | The summary in bold, then its blocks (always open) |
| Columns | A borderless fixed table, one cell per column, widths from the column shares |
| Wrapped `table` block | A `TableGrid` table with a repeated header row and an optional caption |
| Media | An inline picture from host bytes, scaled to the content width, with its alt text; otherwise `[Image: alt]` |
| Page link | Its title, a hyperlink when `pageHref` gives an absolute URL |
| Other wrapped blocks and embeds | Their text (`title`, `label`, `value`…), or `[Kind: title]`, with a diagnostic |
| `page` | Page size and orientation, margins (start and end follow `dir`), header and footer with `PAGE` and `NUMPAGES` fields, explicit breaks as `pageBreakBefore` |
| `annotations` | Dropped |

`DocxOptions`:

- `page`: page settings merged over the document's;
- `resolveImage`: an `ImageResolver`, `(ref, block) =>` the image bytes
  (or a promise of them), PNG or JPEG; `probeImage(bytes)` reads the
  format and size (`ImageInfo`) of what it returns, and images over
  `MAX_IMAGE_BYTES` (20 MiB) are refused;
- `trust`: the URL tier (`untrusted` by default);
- `pageHref`: an absolute URL for a nested page;
- `pageNumbers`: number pages when the settings have no footer (default
  true);
- `compress`: deflate the package where the platform has
  `CompressionStream` (default true; images stay stored).
- `design`: plain design values, a `DocumentDesign` (`colors` as
  `#rrggbb` per `DocumentDesignRole`, `fonts` as CSS stacks), built from
  a compiled design system with `designValues(compiled, mode)` from
  `@texuli/tools/print`. The first concrete family of `fonts.sans` is the
  body font (instead of Calibri), of `fonts.heading` the heading font
  when it differs, and of `fonts.mono` the code font (instead of
  Consolas); `foreground` sets the text color, `link` the hyperlink
  style, `border` every rule and table border, `muted` the code shading,
  and the soft and strong status roles the callout fills and bars (the
  same roles as [the PDF writer](pdf.md#design-systems)). Values outside
  `#rrggbb` or a plain family name are ignored. Without it, the package is
  byte-for-byte the default (a test pins its SHA-256). Word substitutes a
  font the reader does not have; nothing is embedded.

`DOCX_MIME` is the package's media type. Output is deterministic: the same
document gives the same bytes.

## Security

- Sink-free by construction: every part is a tree of
  `@texuli/core/markup` nodes, serialized with escaping and an element and
  attribute allowlist; no part is a string template.
- Links pass `safeHref` at the tier and must be absolute (`https:` or
  `mailto:` at the `untrusted` tier); a refused link keeps its text and
  reports `link-refused`.
- An image ref passes `safeImageSrc` at the tier before the host is asked
  for its bytes; the bytes are sniffed (PNG or JPEG only).
- Hostile text (markup, control characters, unpaired surrogates) is escaped
  or dropped; tests check every part is well-formed XML.

## Not yet

Comments, suggestions and tracked changes in the file, table of contents
fields, and right-to-left run properties are planned.
