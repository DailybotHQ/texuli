# Spreadsheet

> A spreadsheet as data: tabs of cells holding numbers, text, booleans and formulas that recalculate.

- **id:** `spreadsheet`
- **package:** `@texuli/sheets`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `sheets`

### Use when

- A budget, an estimate, a price list or a tracker whose totals people keep editing
- Numbers that depend on other numbers through formulas (SUM, IF, VLOOKUP, DATE…)

### Don't use when

- Read-only records with typed columns, sorting and search: use data-grid
- A chart of values: use a chart family
- A form people fill in once: use schema-form

### Accessibility

- Painted as an APG grid with column letters, row numbers and one tab stop
- Values are text, never HTML; formulas are a closed language with no references built from text and no network
- A formula error shows its code in the cell (#DIV/0!, #REF!, #CYCLE!…)

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `sheet` | object | yes | — | — | A Texuli sheet: { format: "texuli-sheet", formatVersion: 1, meta: { title }, sheets: [{ id, name, rows, columns, cells }] }. cells maps A1 addresses ("B3") to a number, a boolean, text, or a formula that starts with "=" ("=SUM(B1:B2)", "=IF(C2>100, \"high\", \"low\")", "=Rates!A1*B2"). About 50 functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND, SUMIF, COUNTIF, IF, IFS, AND, OR, IFERROR, CONCAT, LEFT, TEXT, INDEX, MATCH, VLOOKUP, XLOOKUP, DATE, TODAY and more. No INDIRECT, OFFSET or RAND. Dates are "YYYY-MM-DD" text. Text that must start with "=" is written "'=…". At most 16 sheets, 10,000 rows, 256 columns and 100,000 cells. |
| `label` | string | no | untrusted | — | Accessible name; defaults to the sheet title. |

### Examples

#### Team offsite budget (`budget`)

```json
{
  "sheet": {
    "format": "texuli-sheet",
    "formatVersion": 1,
    "meta": {
      "title": "Team offsite budget"
    },
    "sheets": [
      {
        "id": "costs",
        "name": "Costs",
        "rows": 8,
        "columns": 4,
        "cells": {
          "A1": "Item",
          "B1": "Unit cost",
          "C1": "Quantity",
          "D1": "Total",
          "A2": "Venue",
          "B2": 1200,
          "C2": 1,
          "D2": "=B2*C2",
          "A3": "Lunch",
          "B3": 18.5,
          "C3": 24,
          "D3": "=B3*C3",
          "A4": "Coffee",
          "B4": 3.25,
          "C4": 48,
          "D4": "=B4*C4",
          "A6": "Total",
          "D6": "=SUM(D2:D4)",
          "A7": "Over budget?",
          "D7": "=IF(D6>2000, \"yes\", \"no\")"
        }
      }
    ]
  }
}
```

### Related

- [`data-grid`](data-grid.md)
- [`document`](document.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
