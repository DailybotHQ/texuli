# CSV (`@texuli/sheets/csv`)

CSV import and export, framework-free.

```ts
import { csvToSheet, sheetToCsv } from '@texuli/sheets/csv';

const imported = csvToSheet(text, { name: 'Orders' }); // formulas stay text
const csv = sheetToCsv(workbook, 'sheet1'); // computed values, injection neutralized
```

## Import

`parseCsv(text, options)` reads RFC 4180 CSV into rows of fields
(`CsvParseResult`): quoted fields with `""` escapes and line breaks inside,
CRLF, LF or CR line ends, a leading byte-order mark, and a `delimiter`
(`CsvDelimiter`: `,`, `;` or a tab; `CsvParseOptions`). A quote inside an
unquoted field is kept as text; a final line break adds no empty row. One
pass over the text, quoted runs copied in slices, never a backtracking
regular expression.

It stops at the first cap it crosses (`CSV_LIMITS`: 8,000,000 characters,
10,000 rows, 256 fields per row, 32,768 characters per field) or at an
unclosed quote, with a `CsvIssue` (`code`, 1-based `line`, `message`).

`csvToSheet(text, options)` imports a one-sheet document and validates it
with `validateSheet` (`CsvToSheetOptions`: `id`, `name`, `title`,
`delimiter`, `types`, `formulas`). Plain numbers and `TRUE`/`FALSE` become
numbers and booleans unless `types` is `false`. **A field that starts with
`=` stays text** (written `'=…`) unless `formulas` is `true`, because a CSV
from elsewhere is untrusted; with it, formulas still pass the sheet grammar
and caps. Text with control or bidi characters is refused.

## Export

`toCsv(rows, options)` writes `CsvValue`s (`CsvWriteOptions`: `delimiter`,
`newline` `\r\n` by default, `neutralize`). Fields with the delimiter, a
quote or a line break are quoted.

**Formula injection is neutralized by default:** text that a spreadsheet
would run as a formula when the file is opened — starting with `=`, `+`,
`-`, `@`, a tab or a carriage return, or their full-width forms — is
written with a leading `'`. Numbers stay numbers (`-5` is a number, not
text), errors are written as their code. `isRiskyCsvText(text)` is the
test it uses. Turn `neutralize` off only for a consumer that never
evaluates cells.

`sheetToCsv(workbook, sheet, options)` exports one sheet trimmed to its used
range (`SheetToCsvOptions`: `values` `computed`, the default, or `inputs`,
where formulas are neutralized text). Re-importing that file with
`formulas: true` restores the text without running it.
