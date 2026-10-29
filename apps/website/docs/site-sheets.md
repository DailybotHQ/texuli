# Sheets page (texuli.com)

**App:** `apps/website`
**Path:** `/sheets-page/` (Components group, after Canvas)
**Packages:** `@texuli/sheets` (`formula`, `model`, `csv`, `view`, `host`),
`@texuli/player`; the sheets package is in development, coming in `0.8.0`
and not published to npm yet (the private `0.0.0` placeholder); the
`spreadsheet` catalog id is spec `0.8.0`
**Tests:** `apps/website/tests/site-sheets.test.ts`, `tests/e2e/site-sheets.spec.ts`

## Goal

Show the spreadsheet engine working and honest: a live workbook in
`SheetView`, every function of the closed set evaluated, incremental
recalculation made visible, cycles, limits and refused formulas from the
real engine, CSV that neutralizes formula injection, and an agent's
spreadsheet painted read-only by the player. The frame is the shared
`FeaturePage.astro`.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| Hero | static | Status (in development, coming in `0.8.0`, not on npm) and the subpaths as pieces. |
| `#workbook` | `SheetWorkbench.svelte` | `SheetView` (tabs, formula bar, the grid's keyboard model) over `ORDERS_WORKBOOK` (an order log and a summary tab with cross-sheet formulas); beside it every formula with its value, marked when the last edit changed it, from a mirror workbook that applies the same edits (`setInputs`, so the counts are the engine's `RecalcResult`); insert and delete rows through the workbook (references rewrite) and Reset. The keys table follows `packages/sheets/docs/view.md`. |
| `#functions` | `FunctionLab.svelte` | A lab: pick any of `SHEET_FUNCTION_INFO`, edit its formula, the engine evaluates it in K1 of the order log (or shows the parse error). Below, the sample data and one table per category with every function, its signature, an example from `FUNCTION_EXAMPLES` (a unit test keeps its keys equal to `SHEET_FUNCTION_NAMES`) and the result computed at build time with a fixed clock. |
| `#recalc` | static | The dependency graph as the parser sees it (`dependencyRows`: each formula and the cells and ranges it reads, never expanded) and what to try above. |
| `#safety` | static | `safetyCases()`, evaluated by the validator and engine at build time: a cycle, a self-including range, a range over 10,000 cells, errors as values, INDIRECT, OFFSET, RAND and LAMBDA, the same in an agent document, bidi text, a missing sheet, a sheet past the caps; the limits and the rules. |
| `#csv` | `CsvLab.svelte` | `csvToSheet` on hostile CSV (formulas stay text unless "Import formulas", which then refuses `HYPERLINK`), the cells as stored, and `sheetToCsv` with injection neutralized; a real download from a Blob. |
| `#agents` | `AgentSheetDemo.svelte` | The blueprint JSON and the hostile `INDIRECT` cell (static), and the real `<Player>` with `sheetHost={createSheetPlayerHost()}`; the hostile workbook is refused before painting. |
| `#in-code`, `#package-docs` | static | Code samples and doc paths. |
