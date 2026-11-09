## What Sheets is

Sheets is an embeddable spreadsheet: `@texuli/sheets` holds an owned formula engine (a linear-time parser into the `@texuli/core/expression` AST, 54 documented functions, a dependency graph with incremental recalculation), a framework-free workbook model, CSV import and export, and an accessible Svelte 5 grid view. The package is published as `0.15.0` and is **in development** (pre-1.0). Pin the exact version or use `^0.15.0`.

It is not a hosted spreadsheet service. Collaboration, localized formula display and native (Kotlin) evaluation are planned, not shipped. The host app stores the workbook.

The technical docs you are reading live at `/guides/solutions/sheets/`.

## What you get

- A validated workbook as data (`format: "texuli-sheet"`, `formatVersion: 1`).
- An owned formula language: no `INDIRECT`, `OFFSET`, `LAMBDA` or `RAND`.
- Structural edits that rewrite references.
- CSV in and out that keeps formula injection neutralized.
- `SheetView` over the `@texuli/data` grid editing layer.

There is no HTML sink. Values paint as text.
