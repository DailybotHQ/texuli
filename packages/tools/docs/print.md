# Print and PDF of blueprints

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/print` ·
**Path:** `src/print/`

> **Status: new in `0.8.0`** (ADR-016); the `0.7.0` release predates it.

Two ways to print a blueprint (ADR-016):

1. **In the browser:** the `@texuli/player` print mode (the `print` prop,
   also applied automatically between the browser's `beforeprint` and
   `afterprint` events) plus the browser's print dialog, whose "Save as
   PDF" writes the file. See the player's docs.
2. **Headless, here:** the blueprint maps to a `@texuli/document`
   document, and the owned PDF writer (`@texuli/document/pdf`) draws it.

```ts
import { blueprintToDocument, renderBlueprintPdf } from '@texuli/tools/print';

const mapped = blueprintToDocument(agentDraft, { title: 'Quarterly brief' });
const pdf = await renderBlueprintPdf(agentDraft, { page: { size: 'a4', orientation: 'portrait' } });
if (pdf.ok) await writeFile('brief.pdf', pdf.bytes);
```

## `blueprintToDocument(draft, options)`

Validates the draft (`validateDraft` at the `untrusted` tier with the deep
block schemas, against the same catalog as `@texuli/tools/email` or
`options.catalog`), maps the sink-free render tree to document blocks, and
validates the document at the `untrusted` tier. It returns a
`BlueprintDocumentResult`: `{ ok: true, document, diagnostics }` or
`{ ok: false, document: null, diagnostics }`. It never throws.

| Blueprint | Document |
| --- | --- |
| Layout `title` and `description` | A heading (level 1 for `layout-page` and `layout-doc`, else 2) and a paragraph |
| `heading` block | A heading (levels 1 to 4) |
| `text`, `list`, `quote`, `callout` and `cta` blocks | Through the document's Markdown codec at the `untrusted` tier (links refused there stay text); labels are escaped so they stay literal |
| `divider`, `code`, `columns` (2 to 4, one level) | `divider`, `code`, `columns` |
| `image`, `figure`, `gallery`, `media-image` | `media` blocks (the writer resolves image bytes through `pdf.resolveImage`, else prints the alt text) |
| `table`, `stat`, `kpi` | Wrapped `table` blocks |
| Anything else | Its text, or nothing, with a `print-unsupported` warning |

`BlueprintDocumentOptions`: `catalog`, `title` (default the first heading,
else `Blueprint`), `page` (page settings: size, orientation, margins,
header and footer) and `locale`.

## `renderBlueprintPdf(draft, options)`

`blueprintToDocument`, then `writePdf` (loaded on use) at the `untrusted`
tier: no JavaScript, forms or embedded files, every string escaped by the
writer, deterministic bytes. It resolves to a `BlueprintPdfResult`:
`{ ok: true, bytes, pageCount, mime, diagnostics }` or `{ ok: false,
bytes: null, pageCount: 0, … }`. `BlueprintPdfOptions` adds `pdf` (the
writer's options except `trust`). A `PrintDiagnostic` has the shape of an
email diagnostic: `{ code, severity, path, message, id? }`; writer
warnings arrive prefixed `pdf-`.
