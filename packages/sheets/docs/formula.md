# Formulas (`@texuli/sheets/formula`)

The sheet formula language of [ADR-015](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic):
an owned, linear-time parser from formula text into the
`@texuli/core/expression` AST, a closed function library, and the bounded
evaluator of the core. Framework-free and DOM-free.

```ts
import { evaluateFormula, parseFormula } from '@texuli/sheets/formula';

const parsed = parseFormula('=SUM(B2:B4) * (1 + Rates!A1)');
if (parsed.ok) {
  const value = evaluateFormula(parsed.formula, {
    ref: (ref) => cells[ref] ?? null, // 'Rates!A1'
    range: (from, to) => readRange(from, to), // 'B2', 'B4' → a flat, row-major list
    now: () => Date.now(), // TODAY() and NOW(); without it they are #N/A
  });
}
```

Most hosts never call these directly: `createWorkbook` from
[model](https://github.com/DailybotHQ/texuli/blob/main/packages/sheets/docs/model.md)
parses, binds and evaluates every cell.

## Grammar

`parseFormula(source)` reads text that starts with `=` and returns a
`FormulaParseResult`: either a frozen `SheetFormula` (`source`, the core
`expression`, its single-cell `refs` and its `ranges`, both as
`CellReference` values in source order) or `diagnostics` with the `error`
the cell shows (`FormulaParseError`: `#NAME?` for an unknown function or
name, `#VALUE!` for everything else). It never throws. `isFormulaInput`
tells whether an input is formula text.

| Part | Syntax |
| --- | --- |
| Numbers | `12`, `3.5`, `.5`, `1e3` |
| Text | `"double quoted"`, `""` for a quote |
| Booleans | `TRUE`, `FALSE` (any case) |
| Cells | `A1`, `$A$1`, `A$1` (anchors), `Sheet2!A1`, `'Q1 plan'!A1` (`''` for a quote) |
| Ranges | `A1:B3`, whole columns `A:C` (bounded to the sheet's rows), on one sheet |
| Deleted references | `#REF!` (what row, column and sheet deletions leave behind) |
| Operators, loosest first | `= <> < <= > >=`, `&`, `+ -`, `* /`, `^`, postfix `%`, unary `-` |
| Calls | `NAME(arg, …)` from the function table below (names ignore case) |

`^` is left-associative and unary minus binds tighter than `^` (`=-2^2` is
4), as in other spreadsheets. Long `+`/`-` and `&` chains are rebalanced so
`=B2+B3+…+B90` stays inside the core depth limit. `IF` compiles to the
core `if` node, so only the chosen branch is evaluated.

**Not supported, by design:** R1C1 references, structured references, array
literals, named ranges, `INDIRECT`, `OFFSET`, `LAMBDA`, `RAND` and anything
that builds a reference from text. Every dependency is visible in the AST,
which is what keeps the dependency graph static and the bounds provable.
Formulas use canonical separators (`,` between arguments, `.` for decimals);
localized display is planned.

The parser validates its tree with the core's `parseExpression`, passing
`SHEET_FUNCTIONS` and `SHEET_REFERENCE_DIALECT` (A1 cells, column endpoints
and `REF_ERROR`), so every node, depth and argument limit of the core holds.

## Limits

| Limit | Value |
| --- | --- |
| Formula text (`FORMULA_LIMITS.length`) | 8,192 characters |
| Nesting the parser follows (`FORMULA_LIMITS.depth`) | 32 |
| AST nodes, depth, evaluation steps, string and list sizes | the core's `EXPRESSION_LIMITS` (1,000 nodes, depth 32, 100,000 steps per formula, 10,000,000 per pass, 32,768 characters, 10,000 list items) |
| Criteria text (`CRITERIA_MAX_LENGTH`) | 255 characters |
| References (`REFERENCE_LIMITS`) | columns to `XFD`, 1,048,576 rows, 64-character sheet names (sheets cap lower) |

Running out of steps, or reading a range of more than 10,000 cells, is the
`#LIMIT!` value; nothing throws or hangs. Errors are values: `#DIV/0!`,
`#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`, `#CYCLE!` (the workbook's
cycle report) and `#LIMIT!`.

## Evaluation

`evaluateFormula(formula, env, options)` runs a `SheetFormula` with
spreadsheet semantics: the `SHEET_FUNCTIONS` table, blanks read as 0 or
empty text, text compared ignoring case. `env.ref` reads one cell,
`env.range` an interval as a flat, row-major list, `env.now` the host clock.
`FormulaEvaluateOptions` takes a pass `budget` (from the core's
`createExpressionBudget`) and per-formula `steps`.

Ranges are flat lists, so `INDEX` and `VLOOKUP` receive the width of their
range from the parser as a hidden first argument: the width is static like
every reference.

Coercions that differ from some spreadsheets: arithmetic on text is
`#VALUE!` (`="5"+1`), and dates are ISO `YYYY-MM-DD` text, so date math goes
through `DATE`, `DAYS` and `EDATE` rather than `+`.

## Functions

`SHEET_FUNCTION_NAMES` lists the 54 functions; `SHEET_FUNCTION_INFO` gives
each one's `SheetFunctionInfo` (`category`, user-facing `minArgs` and
`maxArgs`, `signature`, `description`, `example`, and `shaped` for the
lookups that get a width).

### Math and aggregates

| Function | What it does | Example |
| --- | --- | --- |
| `SUM(value, …)` | Adds the numbers; text and blanks are skipped. | `=SUM(B2:B9)` |
| `AVERAGE(value, …)` | The mean of the numbers; #DIV/0! when there are none. | `=AVERAGE(B2:B9)` |
| `MIN(value, …)` | The smallest number (0 when there are none). | `=MIN(B2:B9)` |
| `MAX(value, …)` | The largest number (0 when there are none). | `=MAX(B2:B9)` |
| `COUNT(value, …)` | How many values are numbers. | `=COUNT(B2:B9)` |
| `COUNTA(value, …)` | How many values are not blank. | `=COUNTA(A2:A9)` |
| `COUNTBLANK(range)` | How many cells are blank or empty text. | `=COUNTBLANK(C2:C9)` |
| `PRODUCT(value, …)` | Multiplies the numbers. | `=PRODUCT(B2, C2)` |
| `MEDIAN(value, …)` | The middle number; #NUM! when there are none. | `=MEDIAN(B2:B9)` |
| `ROUND(number, [digits])` | Rounds half away from zero to a number of digits (negative: tens, hundreds). | `=ROUND(B2, 2)` |
| `ROUNDUP(number, [digits])` | Rounds away from zero. | `=ROUNDUP(B2, 0)` |
| `ROUNDDOWN(number, [digits])` | Rounds toward zero. | `=ROUNDDOWN(B2, 1)` |
| `INT(number)` | Rounds down to an integer. | `=INT(B2)` |
| `MOD(number, divisor)` | The remainder, with the sign of the divisor; #DIV/0! for 0. | `=MOD(B2, 7)` |
| `ABS(number)` | The absolute value. | `=ABS(B2)` |
| `POWER(number, exponent)` | A number raised to a power (exponent at most ±64). | `=POWER(2, 10)` |
| `SQRT(number)` | The square root; #NUM! for a negative number. | `=SQRT(B2)` |
| `SUMIF(range, criteria, [sum_range])` | Adds the cells whose partner matches the criteria (">5", "<>done", "a*", 10). | `=SUMIF(C2:C9, "paid", B2:B9)` |
| `COUNTIF(range, criteria)` | How many cells match the criteria. | `=COUNTIF(C2:C9, ">=100")` |
| `AVERAGEIF(range, criteria, [average_range])` | The mean of the cells whose partner matches the criteria. | `=AVERAGEIF(C2:C9, "east", B2:B9)` |

### Logic

| Function | What it does | Example |
| --- | --- | --- |
| `IF(test, then, [else])` | One of two values; only the chosen branch is evaluated. | `=IF(B2>100, "high", "low")` |
| `IFS(test, value, …)` | The value of the first true test; #N/A when none is true. | `=IFS(B2>90, "A", B2>80, "B", TRUE, "C")` |
| `AND(test, …)` | TRUE when every test is true. | `=AND(B2>0, C2<10)` |
| `OR(test, …)` | TRUE when any test is true. | `=OR(B2>0, C2<10)` |
| `NOT(test)` | The opposite truth value. | `=NOT(D2)` |
| `IFERROR(value, fallback)` | The value, or the fallback when it is an error. | `=IFERROR(B2/C2, 0)` |

### Information

| Function | What it does | Example |
| --- | --- | --- |
| `ISBLANK(value)` | Whether a value is blank. | `=ISBLANK(B2)` |
| `ISNUMBER(value)` | Whether a value is a number. | `=ISNUMBER(B2)` |
| `ISTEXT(value)` | Whether a value is text. | `=ISTEXT(A2)` |
| `ISERROR(value)` | Whether a value is an error. | `=ISERROR(B2/C2)` |
| `NA()` | The #N/A error. | `=NA()` |

### Text

| Function | What it does | Example |
| --- | --- | --- |
| `CONCAT(text, …)` | Joins text (ranges row by row); at most 32,768 characters. | `=CONCAT(A2, " ", B2)` |
| `LEN(text)` | The number of characters. | `=LEN(A2)` |
| `LEFT(text, [count])` | The first characters (1 by default). | `=LEFT(A2, 3)` |
| `RIGHT(text, [count])` | The last characters (1 by default). | `=RIGHT(A2, 4)` |
| `MID(text, start, count)` | Characters from a 1-based start. | `=MID(A2, 2, 3)` |
| `UPPER(text)` | Upper case. | `=UPPER(A2)` |
| `LOWER(text)` | Lower case. | `=LOWER(A2)` |
| `TRIM(text)` | Removes outer spaces and collapses runs of spaces. | `=TRIM(A2)` |
| `TEXT(value, format)` | A number or date as text in one of the closed formats (see the docs). | `=TEXT(B2, "#,##0.00")` |
| `SUBSTITUTE(text, old, new, [instance])` | Replaces every (or the nth) occurrence of a text. | `=SUBSTITUTE(A2, "-", " ")` |
| `VALUE(text)` | A number from plain decimal text ("12.5", "40%"). | `=VALUE(A2)` |

### Lookup

| Function | What it does | Example |
| --- | --- | --- |
| `INDEX(range, row, [column])` | The cell at a 1-based row and column of a range; #REF! outside it. | `=INDEX(A2:C9, 3, 2)` |
| `MATCH(key, range, [type])` | The 1-based position of a key: 0 exact, 1 (default) largest not above, -1 smallest not below. | `=MATCH("Lima", A2:A9, 0)` |
| `VLOOKUP(key, range, column, [approximate])` | Finds a key in the first column and returns a column of that row; FALSE for an exact match. | `=VLOOKUP("Lima", A2:C9, 3, FALSE)` |
| `XLOOKUP(key, lookup_range, return_range, [if_not_found])` | Exact lookup in one range, the partner in another. | `=XLOOKUP("Lima", A2:A9, C2:C9, "none")` |

### Dates

| Function | What it does | Example |
| --- | --- | --- |
| `DATE(year, month, day)` | The ISO date (YYYY-MM-DD); months and days past their range roll over. | `=DATE(2026, 11, 2)` |
| `YEAR(date)` | The year of an ISO date. | `=YEAR(A2)` |
| `MONTH(date)` | The month (1–12) of an ISO date. | `=MONTH(A2)` |
| `DAY(date)` | The day of the month of an ISO date. | `=DAY(A2)` |
| `DAYS(end, start)` | Whole days from start to end. | `=DAYS(B2, A2)` |
| `EDATE(date, months)` | The date a number of months later (or earlier), clamped to the month end. | `=EDATE(A2, 3)` |
| `TODAY()` | The host clock's UTC day; #N/A when the host gave no clock. | `=TODAY()` |
| `NOW()` | The host clock as an ISO date-time (UTC); #N/A without a clock. | `=NOW()` |

### Criteria

`SUMIF`, `COUNTIF` and `AVERAGEIF` take a value (`10`, `TRUE`) or text with
an optional comparison (`">5"`, `"<>done"`, `"=east"`). Equality on text
ignores case and understands `*` (any run), `?` (one character) and `~`
(escapes the next). `compileCriteria(criterion)` returns a `CriteriaMatcher`
(or `#VALUE!` past `CRITERIA_MAX_LENGTH`). The matcher never backtracks: a
pattern splits at `*`, the first piece anchors at the start, the last at
the end, and each middle piece takes its leftmost match. Work is charged as
steps, so a hostile pattern over long cells ends in `#LIMIT!`.

### TEXT formats

`TEXT` and `formatText(value, format)` accept only `SHEET_TEXT_FORMATS`
(matched whole, ignoring case): `General`, `@`, `0`, `0.0`, `0.00`,
`0.000`, `#,##0`, `#,##0.0`, `#,##0.00`, `0%`, `0.0%`, `0.00%`,
`yyyy-mm-dd`, `dd/mm/yyyy`, `mm/dd/yyyy` and `yyyy`. There is no format
language to parse. `numberText` is the general display of a number (up to
15 significant digits, no float noise).

## References

- `CellReference`: `sheet` (or `null` for the formula's own sheet),
  0-based `col` and `row` (`null` for a whole-column endpoint), and the
  `colAbsolute` and `rowAbsolute` anchors.
- `parseReference(text, allowColumn)`, `parseCellPart(text, sheet,
  allowColumn)`, `formatReference(ref)`.
- `columnName(0)` is `A`, `columnIndex('AB')` is 27; `cellAddress(row, col)`
  and `parseCellAddress('B3')` convert plain addresses.
- `isSheetName(name)`: 1–64 characters, no control or bidi characters and
  none of `[]*?/\:`; `quoteSheetName(name)` writes it as a reference prefix.

## Rewriting references

`rewriteFormula(source, visit)` rewrites only the reference tokens of a
formula and keeps every other character the author typed. The visitor
receives each `ReferenceTarget` (a `cell`, or a `range` on one sheet) and
returns a new target, `null` (the reference becomes `#REF!`) or `undefined`
(keep it). `ReferenceVisitor` is its type. The workbook uses it for row,
column and sheet changes.

`tokenizeFormula(body, offset)` is the one-pass tokenizer (`FormulaToken`
values with spans) the parser and the rewriter share.
