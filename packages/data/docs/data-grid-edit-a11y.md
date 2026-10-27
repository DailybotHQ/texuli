# Editable grid accessibility: read-only cells, editor focus, tab stop

**Package:** `@texuli/data`
**Subpaths:** `@texuli/data/grid-editing` (`EditableDataGrid`), `@texuli/data/grid-core` (`DataGrid`)
**Tests:**
- **Component:** `packages/data/tests/grid-edit-a11y.test.ts`, which
  covers the plain grid and the windowed one (100,000 rows).
- **Browser:** `tests/e2e/data.spec.ts` (the data grid test), which covers
  both editing examples.

**Examples:** `data-grid-editing`, `data-grid-editing-virtual`

## Read-only cells

In an editable grid, a cell whose column doesn't set `editable: true` has
`aria-readonly="true"` on its `role="gridcell"` element.
- **The inner `div.tx-grid-edit__cell`** has no role and carries no ARIA
  state. `aria-readonly` there was an axe `aria-allowed-attr` violation.
- **`EditableDataGrid`** turns this on for you: it passes `editable` to
  `DataGrid`.
- **A plain `DataGrid` with `editable`** marks cells the same way:
  - columns with `editable: true` are editable;
  - every other column is read-only.
- **Without `editable`:** no cell carries `aria-readonly`.

## Starting an edit

Each of these opens the inline editor and moves focus into it:
- Enter on the focused cell, whether reached with a click or the arrow
  keys;
- F2 on the focused cell;
- double click.

A read-only cell opens no editor.

**Stable hook:** the editor control (an `input`, a `select`, or a switch
for booleans) always carries `data-tx-grid-editor`. Tests and hosts should
select it with `[data-tx-grid-editor]`. Texuli never had a `data-editor`
attribute.

## Tab stop and closing

- **While the editor has focus:** it is the grid's only tab stop, and its
  cell drops to `tabindex="-1"`. This follows the WAI-ARIA grid pattern for
  a cell that holds one widget. It also means the cell and the editor never
  count as two overlapping touch targets: axe's `target-size` rule flagged
  this when the cell kept `tabindex="0"`.
- **Any `[data-tx-grid-widget]` in a cell:** `DataGrid` hands the tab stop
  over in the same way. The cell gets it back when focus leaves the widget.
- **Enter (save) or Escape (cancel):** closes the editor and returns focus
  to its cell.
- **Moving focus away** (Tab, or a click elsewhere): saves the edit, and
  focus stays where the user put it.

## Measured size

`pnpm size`, gzip:

| Entry | Before (dev) | After | Cap |
| --- | --- | --- | --- |
| `@texuli/data/grid-editing` | 15,316 B | 15,352 B | 15,360 B |
| `@texuli/data/grid-core` | 10,882 B | 10,936 B | 12,288 B |

To make room in grid-editing:
- the loading and empty grid now share one cell;
- the instructions labels are derived directly.

## Limits

- **Screen readers:** checked with axe in light and dark, with the editor
  open. Not checked with a real screen reader.
- **`aria-readonly` in a plain DataGrid:** it follows each column's
  `editable` flag only when the grid sets `editable`.
