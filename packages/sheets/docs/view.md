# Sheet view (`@texuli/sheets/view`)

`SheetView` paints a workbook as an accessible spreadsheet over the
`@texuli/data` grid editing layer (`EditableDataGrid`).

```svelte
<script lang="ts">
  import { SheetView } from '@texuli/sheets/view';
  import { createSheet, type SheetDocument } from '@texuli/sheets/model';
  import '@texuli/tokens/base.css';

  let sheet: SheetDocument = $state(createSheet({ rows: 50, columns: 8, title: 'Budget' }));
</script>

<SheetView bind:sheet now={() => Date.now()} />
```

Validate a sheet from a file or an agent with `loadUntrustedSheet` or
`validateSheet` first.

## Props

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `sheet` | `SheetDocument` | required | The workbook (`bind:sheet`); every edit emits a new document |
| `activeSheet` | `string` | the first | The id of the sheet shown (`bind:activeSheet`) |
| `readonly` | `boolean` | `false` | Cells cannot be edited (they are `aria-readonly`) |
| `label` | `string` | the title, then the sheet name | The grid's accessible name |
| `onchange` | `(sheet) => void` | — | Called with the new document after every edit |
| `now` | `() => number \| Date` | — | The host clock for `TODAY` and `NOW` (without it they show `#N/A`) |
| `formulaBar` | `boolean` | `true` | Shows the focused cell's address and typed input |
| `labels` | `Partial<SheetViewLabels>` | English | Every text the view shows |
| `density` | `'compact' \| 'default' \| 'comfortable'` | `compact` | Row density |
| `virtualizeAbove` | `number` | `1000` | Render only the rows in view past this many rows |
| `viewportHeight` | `number` | `420` | Scroll area height in px while windowing |
| `class` | `ClassValue` | — | Extra classes on the root |

`SheetViewLabels` (`DEFAULT_SHEET_VIEW_LABELS`, merged by
`resolveSheetViewLabels`): `sheets` (the tab group), `row` (the row-number
header), `formulaBar`, `sheet` (the caption prefix) and `formulaError`.

## Behavior

- Cells show computed values (errors as their code); the editor opens on
  what was typed, so a formula cell edits its formula.
- The cell editor is a lazy chunk of `@texuli/data/grid-editing`, loaded on
  the first Enter or F2, so it appears a moment after the key. Host tests
  await it before typing, for example `await screen.findByRole('textbox', {
  name: 'B' })` (the editor is named by its column letter).
- Typed text is read by `parseSheetInput` (numbers, booleans, formulas,
  text). A formula with a syntax error is refused with an announced
  message and nothing changes; an unknown function is saved and shows
  `#NAME?`.
- A new `sheet` from the host (not one the view emitted) rebuilds the
  workbook.
- Several sheets get a group of toggle buttons (`aria-pressed`).

## Accessibility

The grid is the data grid's APG grid: one tab stop, arrow keys, Home and
End, Page Up and Down between cells, Enter or F2 to edit, Escape to cancel,
Control or Command plus Z and Y to undo and redo, C and V to copy and paste
TSV blocks. Columns are named by their letters and the first column holds
row numbers. The formula bar is a named group (`Formula bar`). Rows window
past `virtualizeAbove` with focus kept. The view is axe-clean in its tests;
CSS uses logical properties and keeps focus and the active tab visible in
forced colors. The root class is `tx-sheets-view` (parts `tx-sheets-view__*`,
marker `data-tx-sheets-view`), never texuli's `tx-sheet` drawer classes, so a
page can load both stylesheets; a test keeps the two apart.
