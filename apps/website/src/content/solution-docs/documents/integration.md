## Editor and reader

`PageEditor` from `@texuli/pages/editor` edits the document: slash menu, block selection and drag with keyboard equivalents, nested pages, columns, and embeds painted by `@texuli/player` at the untrusted tier. `PageReader` from `@texuli/pages/reader` is the read-only view with an outline.

Every change is a `@texuli/document` operation. Keep the document in `$state.raw`.

## Paged view and export

`PagedView` from `@texuli/pages/paged` lays the document on real pages (A4, Letter and others) through `@texuli/document/paged`. It is read-only. `exportDocument` from `@texuli/pages/export` writes Markdown, DOCX or PDF as a `Blob`.

```ts
import { downloadBlob, exportDocument } from '@texuli/pages/export';

const { blob, filename, diagnostics } = await exportDocument(doc, 'pdf');
downloadBlob(blob, filename);
```

## Collaboration

`CollabEditor` from `@texuli/pages/collab` sits on `@texuli/document/collab`. The host supplies a `SyncAdapter`. There is no hosted collab service. Comments, suggestions and versions are in development with the rest of the package.
