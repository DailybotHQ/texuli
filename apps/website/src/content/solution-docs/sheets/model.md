## Workbook

The canonical document is data: `format`, `formatVersion`, optional `meta`, and `sheets`. Each tab has a stable `id`, a `name` formulas use, `rows`, `columns` and `cells` keyed by A1 address. `validateSheet` refuses unknown members, sizes past `SHEET_LIMITS`, control and bidi characters, and formulas that do not parse. It never throws.

`loadUntrustedSheet` from `@texuli/sheets/model` bounds work then validates. `createWorkbook` keeps computed values current; `setInput` recalculates only dependents.

```ts
import { createWorkbook, loadUntrustedSheet, validateSheet } from '@texuli/sheets/model';
```

## Owned formula engine

`parseFormula` and `evaluateFormula` live in `@texuli/sheets/formula`. The parser is linear-time into the `@texuli/core/expression` AST. Fifty-four documented functions sit in a closed table. Evaluation is bounded: overruns are `#LIMIT!`, cycles are `#CYCLE!`. `TODAY` and `NOW` read the clock the host passes.

```ts
import { evaluateFormula, parseFormula } from '@texuli/sheets/formula';

const parsed = parseFormula('=SUM(B2:B4)');
```

Most hosts never call these directly: `createWorkbook` parses, binds and evaluates every cell.

## CSV

`@texuli/sheets/csv` parses and writes CSV, imports as a sheet and exports a sheet. Import keeps `=…` fields as text unless the caller opts in. Export neutralizes formula injection (`=`, `+`, `-`, `@`, tab, carriage return).
