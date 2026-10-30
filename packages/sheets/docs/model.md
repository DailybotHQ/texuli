# Workbook model (`@texuli/sheets/model`)

The framework-free, DOM-free workbook: the sheet format and its validator,
the dependency graph, and the engine that keeps computed values current.

```ts
import { createWorkbook, displayValue, loadUntrustedSheet } from '@texuli/sheets/model';

const loaded = loadUntrustedSheet(json); // a file, a share link, an agent
if (loaded.ok) {
  const workbook = createWorkbook(loaded.sheet, { now: () => Date.now() });
  workbook.setInput('costs', 0, 1, 150); // B1 = 150; only its dependents recalculate
  displayValue(workbook.value('costs', 2, 1)); // the new total
  const next = workbook.toDocument(); // store it
}
```

## The format

A `SheetDocument` is `{ format: "texuli-sheet", formatVersion: 1, meta?:
{ title }, sheets }`. Each `SheetTab` has a stable `id`
(`SHEET_ID`: 1–64 of `A–Z a–z 0–9 _ -`), a `name` formulas use, `rows`,
`columns` and `cells`: inputs keyed by A1 address. A `SheetInput` is a
number, a boolean, text, or formula text that starts with `=`; a text that
must start with `=` is written with a leading `'` (`'=not a formula`). A
`SheetValue` is what a cell shows: a number, text, a boolean, `null` for
blank, or an error value.

```json
{
  "format": "texuli-sheet",
  "formatVersion": 1,
  "meta": { "title": "Office budget" },
  "sheets": [
    {
      "id": "costs",
      "name": "Costs",
      "rows": 20,
      "columns": 4,
      "cells": { "A1": "Desk", "B1": 120, "A2": "Chair", "B2": 80, "B3": "=SUM(B1:B2)" }
    }
  ]
}
```

`createSheet({ rows, columns, title, name })` makes an empty one-sheet
document.

### Limits

`SHEET_LIMITS`: 16 sheets, 10,000 rows and 256 columns (`IV`) per sheet,
100,000 non-blank cells, 32,768 characters per text input, 4,000,000
characters of text in all, a 200-character title, 8,000,000 characters of
JSON for `loadUntrustedSheet`, and `passWork` (2,000,000 dependents and
intervals one recalculation may visit).

## Validation

`validateSheet(input)` checks untrusted input and returns a
`SheetValidation`: a normalized, frozen copy holding only known members, or
`SheetIssue`s (`code`, a JSON `path`, `message`, `severity`). It refuses
unknown members, another format, bad or duplicate ids and names (names
ignore case), sizes past the limits, addresses outside the sheet, inputs
that are not numbers, booleans, text or formulas, control and bidi
characters in text, and formulas that do not parse or that read a sheet
that does not exist. A formula that reads past the edge of its sheet is a
warning (it shows `#REF!`). Linear in the input; a hostile document stops
at the first cap it crosses. `csvToSheet` adds the CSV reader's own codes
(`not-text`, `too-many-rows`, `too-many-columns`, `field-too-long`,
`unterminated-quote`, besides `too-large`; see [csv.md](csv.md)).

`loadUntrustedSheet(json)` caps and parses JSON text, then validates.
`checkSheetDraft(sheet, tier)` is the draft check to inject as `checkSheet`
into `validateDraft` from `@texuli/catalog/validate` (sheets are data at
every tier).

## Inputs and display

- `parseSheetInput(text)`: what someone typed. Empty is blank; `=…` is a
  formula; `'…` is literal text; `TRUE`/`FALSE` are booleans; plain decimal
  (`12`, `-3.5`, `1e3`, `40%`) is a number; everything else is text
  (`1,000` stays text).
- `inputText(input)`: the text an editor shows; `literalValue(input)`: the
  value of an input that is not a formula; `isFormula(input)`.
- `displayValue(value)`: numbers in general format, booleans as
  `TRUE`/`FALSE`, errors as their code.

## The workbook

`createWorkbook(document, options)` (`WorkbookOptions`: `now`, the host
clock for `TODAY` and `NOW`; `passSteps`, at most the core's 10,000,000)
returns a `Workbook`:

| Member | What it does |
| --- | --- |
| `sheets`, `sheet(id)` | `WorkbookSheet`s: `id`, `name`, and the stable `rowIds` and `columnIds` in order |
| `title` | The document title |
| `value(sheet, row, col)`, `input(…)`, `diagnostics(…)` | The computed value, the typed input, and the parse diagnostics of a formula cell (0-based row and column) |
| `setInput(sheet, row, col, input)`, `setInputs(edits)` | Write cells (`CellEdit`s) and recalculate once |
| `insertRows`, `deleteRows`, `insertColumns`, `deleteColumns` | Structural edits (sheet, 0-based index, count) |
| `renameSheet`, `addSheet`, `removeSheet` | Sheet edits; formulas follow renames, and references to a removed sheet become `#REF!` |
| `recalculate()` | Recalculate every formula |
| `lastPass` | The last `RecalcResult` |
| `toDocument()` | The inputs back as a `SheetDocument`, row-major |

Every write returns a `RecalcResult`: formulas `evaluated`, the cells whose
value `changed` (as `SheetCellAddress`es), `cycles` found, whether the pass
was `limited`, and the evaluation `steps` spent.

### Recalculation

`DependencyGraph` keys formulas by stable cell keys (sheet, row id, column
id). A single-cell reference is one reverse edge; a range is one interval
per column it spans, never one edge per cell, so `=SUM(A1:A10000)` costs
one entry. `dirtyOrder` walks from the changed cells to every formula that
depends on them (`GraphCell`s, with `FormulaDependencies` registered by
`set`), orders them topologically and finds cycles among the rest with an
iterative Tarjan pass, returning a `DirtyOrder`. So:

- a cell edit evaluates only its dependents (`lastPass.evaluated`), in
  dependency order, independent formulas in sheet order;
- a cycle (including a range that contains its own cell) shows `#CYCLE!`,
  as do the cells that read it; breaking the cycle recovers them;
- one pass shares the step budget and the `passWork` cap: past them cells
  show `#LIMIT!` instead of stalling;
- 10,000-cell chains and cycles run without recursion.

### Structural edits

Inserting or deleting rows and columns rewrites the references in every
formula that points at the sheet (`=SUM(A1:A3)` grows to `=SUM(A1:A5)` when
two rows are inserted inside it; a deleted single cell becomes `#REF!`; a
range shrinks, and a range deleted whole becomes `#REF!`), keeping the rest
of the formula text as typed. Row and column ids stay stable, and the
whole workbook recalculates once. A sheet keeps at least one row and
column.

Collaboration (a sheet binding on `@texuli/document/sync`, ADR-010) is
planned; the stable row and column ids are what it will key cells by.
