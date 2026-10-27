# Data grid core

**Package:** `@texuli/data` · **Import:** `import { DataGrid } from '@texuli/data/grid-core'` (also from `@texuli/data`)

`DataGrid` is the view of the framework-free grid engine (`@texuli/data/grid`).
- **Base:** it renders a WAI-ARIA [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) on the texuli `Table`.
- **Features:** columns, multi-key sorting, search, the engine's filter AST, row selection, and keyboard navigation from cell to cell.
- **Origin:** it is ported from the behavior of Protoyard's `DataTable` (sort, search, selection), with an owned keyboard model.

```svelte
<script lang="ts">
  import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';
  let sort = $state([{ key: 'amount', direction: 'desc' as const }]);
  let selected = $state<string[]>([]);
  const columns: DataGridColumn<Deal>[] = [
    { key: 'name', header: 'Deal', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'number', format: (v) => money(Number(v)) },
  ];
</script>

<DataGrid rows={deals} {columns} getRowId={(d) => d.id} caption="Deals"
  searchable selectable bind:sort bind:selected />
```

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `rows`, `columns`, `getRowId` | required | Rows, `DataGridColumn<T>[]` (an engine column plus `sortable`, `searchable`, `align` and `format`), and a stable row id |
| `caption` | required | The grid's accessible name (`<caption>`); `captionHidden` keeps it for assistive technology only |
| `sort` | `[]` | `bind:sort`: the engine's `GridSort`, primary key first. `onSortChange` |
| `search`, `searchable` | `''`, `false` | `bind:search`; `searchable` shows a labelled search field |
| `filter` | none | A `FilterNode` AST, validated by `compileFilter` (an invalid filter throws) |
| `selectable`, `selected` | `false`, `[]` | A selection column; `bind:selected` holds row ids in row order. `onSelectionChange` |
| `rowLabel` | first column's text | Names a row for its checkbox |
| `onRowActivate` | none | Enter on a body cell |
| `cell` | none | Snippet `(row, column)` for custom cell content; default is the column's text |
| `empty`, `loading` | none, `false` | Empty snippet; `loading` shows a row and sets `aria-busy` |
| `maxBlockSize` | none | Caps the height (a plain CSS length) with a sticky header |
| `density` | `default` | `compact`, `default` or `comfortable` (the Table's) |
| `virtualizeAbove` | off (`Infinity`) | Windows the rows once more than this many are visible: only the rows in view (plus `overscanRows`) render, with spacer rows for the rest; the focused row stays rendered wherever it is. `rowSize` (default `36`) must match the density's real row height, `viewportHeight` (default `360`) sizes the scroll area unless `maxBlockSize` is set. Details: [data-grid-edit-virtual](./data-grid-edit-virtual.md) |
| `locale` | `en` | Text sort order (the engine never uses the system locale) |
| `labels` | English | Every visible and announced string, all translatable (`resolveDataGridLabels`) |

## Behavior

- **Rows:** filter (AST), then search, then a stable sort (`gridRows`).
  - Search matches every word of the query in the searchable columns' display text, ignoring case and accents. By default, text and enum columns are searchable.
  - Cells are always plain text (`cellText`): a `format` result, the value as text, or an ISO day for dates. They are never markup.
- **Sorting:**
  - A header's button cycles none → ascending → descending → none, and the column becomes the only key.
  - Shift adds, cycles or removes the column as a further key. Its rank shows when there are several keys.
  - `aria-sort` marks the primary key only.
  - `sortable: false` renders a plain header.
- **Selection:**
  - A native checkbox per row and a tri-state header checkbox that selects or clears the visible rows.
  - Shift, on click or Space, selects a range from the last toggled row.
  - Rows carry `aria-selected`, and the table carries `aria-multiselectable`.
  - Selection uses the engine's helpers (`toggleRow`, `selectRange`, `setVisibleSelected`, `selectionState`).
- **Status:** a polite live region reports "N of M rows" and "K selected".

## Keyboard (APG grid)

The grid is a single tab stop: one cell, or the one widget inside it, has `tabindex="0"`. A cell holding a single widget (the sort button, the row checkbox) passes focus to that widget.

| Key | Action |
| --- | --- |
| ArrowUp, ArrowDown | Previous and next row, stopping at the edges |
| ArrowLeft, ArrowRight | Previous and next column; swapped in RTL |
| Home, End | First and last cell of the row |
| Ctrl/Cmd + Home, Ctrl/Cmd + End | First and last cell of the grid |
| PageUp, PageDown | Ten rows |
| Enter, Space on a header | Sort; Shift adds a key |
| Space on a body cell | Toggle the row; Shift selects a range |
| Ctrl/Cmd + A | Select every visible row, or clear them when all are selected |
| Enter on a body cell | `onRowActivate(row)` |

The keys are described to assistive technology through `aria-describedby` (the `instructions` label). `aria-rowcount`, `aria-colcount`, `aria-rowindex` and `aria-colindex` are set.

## Verified

- `pnpm vitest run packages/data/tests/grid-core.test.ts`: **26 tests**.
  - Model: sort cycling and Shift keys, `aria-sort`, accent-folding search, filter then search then sort, invalid filters rejected, `cellText`, every APG key including RTL and the edges, clamping, labels.
  - Component: grid roles and counts, one tab stop, header sorting with Shift, non-sortable headers, search with the count, filter, keyboard movement, Space and Shift+Space selection, the header tri-state, Ctrl/Cmd+A, Enter activation, loading and empty states, translations, and hostile cell text kept as text.
  - Windowing: the view plus overscan renders with spacer rows for the rest, `aria-rowcount` stays the full set, scrolling moves the window, the focused row stays rendered past it, and windowed cells never wrap (the `rowSize` math).
- In the browser (Chromium, WebKit, Pixel 7; a scratch spec on port 4810), the `data-grid-core` example:
  - passes **axe** in light, dark and forced colors;
  - takes one Tab into the grid, and arrows, Enter on a header (sort) and Space (select) behave as above;
  - narrows its rows on search;
  - in the RTL grid, ArrowLeft moves to the next column.
- Visual baselines: `data-grid-core`, light and dark, on Chromium and the Pixel 7.

## Limits

- **Windowed rows must stay single-line.** The scroll math derives positions from `rowSize`, so windowed cells never wrap at any width — their table scrolls sideways instead. A large grid can also use `@texuli/data/virtual-list`.
- **No pagination or grouping in the view.** (`ColumnGrid` adds group headers; the engine has groups.)
- **No column resizing, reordering or pinning UI.** The engine's column state supports them.
- **No cell editing.** Cells are read-only; an editable grid is a separate task.
- **Wide grids scroll inside the Table's wrapper,** which becomes a focusable, named region.
