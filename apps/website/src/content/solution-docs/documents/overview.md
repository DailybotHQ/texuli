## What Documents is

Documents is a complete edit-read-export system: `@texuli/document` holds the framework-free block format, validator, operations with undo, Markdown, pagination, owned DOCX and PDF writers and CRDT sync; `@texuli/pages` is the Svelte 5 editor, reader, paged view, export and collaboration on top of it; `@texuli/editor` is the rich-text surface inside text blocks. All three packages are published as `0.16.1` and are **in development** (pre-1.0). Pin the exact version or use `^0.16.0`.

Editor and Pages are subsolutions of Documents, not separate Solutions.

## What you get

- A validated document as data (`format: "texuli-document"`, `formatVersion: 1`), not HTML.
- Typed operations with exact inverses and an op log, so undo, persistence and sync share one history.
- Markdown in and out, plus owned DOCX and PDF writers.
- `PageEditor` and `PageReader` for people; `document.run` and `document.export` for agents.

There is no hosted editor and no document storage. The host app keeps the data. Paged-view editing is planned; the paged view is read-only today.
