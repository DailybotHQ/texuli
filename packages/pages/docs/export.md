# `@texuli/pages/export`

Export a document as Markdown, DOCX or PDF, as a `Blob`. Each format's
writer loads on first use (`@texuli/document/markdown`, `docx` and `pdf`),
so a page that never exports never pays for them.

> **Status: in development.** Not on npm yet (first release planned for
> `0.7.0`).

```ts
import { downloadBlob, exportDocument } from '@texuli/pages/export';

async function save(format: 'markdown' | 'docx' | 'pdf') {
  const { blob, filename, diagnostics } = await exportDocument(doc, format, {
    pdf: { resolveImage: (ref) => imageBytes.get(ref) },
  });
  downloadBlob(blob, filename);
  if (diagnostics.length) console.info(diagnostics);
}
```

## API

- `exportDocument(doc, format, options)` returns an `ExportResult`: the
  `format`, the `blob` (with the format's media type), a safe `filename`,
  the `pageCount` for PDF, and the writer's `diagnostics`. `ExportOptions`:
  `filename` (without extension; the document title by default), and the
  per-format options `markdown`, `docx` and `pdf` (passed to
  `documentToMarkdown`, `writeDocx` and `writePdf`).
- `ExportFormat` is `markdown`, `docx` or `pdf`; `EXPORT_FORMATS` lists
  them and `EXPORT_TYPES` gives each one's extension and media type.
- `exportFileName(title, format)`: letters and digits of any script, `-`
  and `_`; everything else collapses to `-`; at most 80 characters; never
  empty, never hidden, never a reserved device name.
- `downloadBlob(blob, filename, owner?)`: saves the blob through a `blob:`
  URL it creates, an `<a download>` it clicks and removes, and revokes the
  URL right after. The file name is cleaned again.

## Security

An export never navigates to a URL from the document: the only URL it
opens is the `blob:` URL it made. Links inside the files pass the URL
policy at the `untrusted` tier by default, image refs pass `safeImageSrc`
before your `resolveImage` is asked for their bytes, and the writers are
sink-free by construction (see the `@texuli/document` DOCX and PDF docs).
