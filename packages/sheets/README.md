# @texuli/sheets

Spreadsheets for [Texuli](https://texuli.com?utm_source=dailybotopensource),
an MIT-licensed Svelte 5 component library by Dailybot, Inc. (*Small
pieces. Infinite possibilities.*). An owned formula engine (a linear-time
parser into the `@texuli/core/expression` AST, 54 documented functions, a
dependency graph with incremental recalculation, cycle reports and bounded
evaluation), a framework-free workbook model with structural edits that
rewrite references, CSV import and export that neutralizes formula
injection, and an accessible Svelte 5 sheet view over the `@texuli/data`
grid editing layer.

> **Status: in development (pre-1.0).** `@texuli/sheets` is published on
> npm as `0.8.1`, with provenance (first released as `0.8.0`; built in PLAN_010).
> Under 0.x a new minor (`0.9.0`) may contain breaking changes, so pin the
> exact version or use `^0.8.0`, which accepts only 0.8.x
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).
> Agents emit sheets as data through the `spreadsheet` catalog id of
> blueprint spec `0.8.0`, checked by `checkSheetDraft`, and
> `@texuli/player` paints them through its `sheetHost` seam with
> `createSheetPlayerHost()` from `./host`. Planned, not shipped:
> collaboration on `@texuli/document/sync`, localized formula display, and
> native (Kotlin) evaluation.

It sits on layer L5 ([ADR-015](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic)):
the view builds on `@texuli/data` (L4), so the package sits above it. It
depends on `@texuli/core` (the expression core), `@texuli/date` (date
functions), `@texuli/data` (grid editing) and `texuli` (`cx`); `svelte`
(^5.57.2) is a peer dependency. The `formula`, `model` and `csv` subpaths
import no Svelte and no DOM.

## Install

```bash
npm install @texuli/sheets
```

In the Texuli workspace, depend on it as `"@texuli/sheets": "workspace:*"`.
It has no third-party runtime dependencies; its `@texuli/*` and `texuli`
dependencies come with it. Import the token stylesheet once
(`@texuli/tokens/base.css`).

## Quick start

```svelte
<script lang="ts">
  import { loadUntrustedSheet } from '@texuli/sheets/model';
  import { SheetView } from '@texuli/sheets/view';
  import '@texuli/tokens/base.css';

  let { json }: { json: string } = $props();
  // Sheets from a file, an agent or a share link: validated first.
  const loaded = loadUntrustedSheet(json);
  let sheet = $state(loaded.ok ? loaded.sheet : null);
</script>

{#if sheet}
  <SheetView bind:sheet now={() => Date.now()} />
{/if}
```

## Subpaths

| Subpath | What it holds | Docs |
| --- | --- | --- |
| `.` | Everything below, re-exported, and `SHEETS_PACKAGE_VERSION` | this page |
| `./formula` | Framework-free: the grammar and parser, the function library, criteria, TEXT formats, references and the reference rewriter | [formula](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/formula.md) |
| `./model` | Framework-free: the sheet format, `validateSheet` and `loadUntrustedSheet`, the dependency graph and the workbook engine | [model](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/model.md) |
| `./csv` | Framework-free: CSV parse and write, import as a sheet, export a sheet | [csv](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/csv.md) |
| `./view` | `SheetView`: the accessible spreadsheet with tabs and a formula bar | [view](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/view.md) |
| `./host` | `createSheetPlayerHost`: the sheet half of the player's `sheetHost` seam (pass it as `sheetHost` on `Player`) and its draft check | [host](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/host.md) |

`SHEETS_PACKAGE_VERSION` equals the package version (`0.8.1`).

## Security

- Sheets are data. `validateSheet` refuses unknown members, sizes past
  `SHEET_LIMITS`, control and bidi characters, and formulas that do not
  parse, in time linear in the input.
- Formulas are a closed language: no `INDIRECT`, `OFFSET`, `LAMBDA`, `RAND`
  or anything that builds a reference from text or reaches the host
  (only `TODAY` and `NOW` read the clock the host passes). Every function is
  a pure entry in a closed table.
- Evaluation is bounded: per-formula and per-pass step budgets, a graph
  work cap, 10,000-item ranges and 32,768-character strings. Overruns are
  `#LIMIT!`, cycles are `#CYCLE!`; nothing throws or hangs.
- CSV import keeps `=…` fields as text unless the caller opts in; CSV export
  neutralizes formula injection (`=`, `+`, `-`, `@`, tab, carriage return).
- Values paint as text; there is no HTML sink (`{@html}`, `innerHTML`,
  `eval` and `new Function` are absent).

## Accessibility

The view is the data grid's APG grid with one tab stop, arrow-key
navigation, Enter or F2 to edit, Escape to cancel, undo and redo, and TSV
copy and paste; columns are named by their letters, the first column holds
row numbers, and the formula bar is a named group. Formula errors are
announced. See [view](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/view.md).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-sheets).
