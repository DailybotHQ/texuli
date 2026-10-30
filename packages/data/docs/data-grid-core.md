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
| `rows`, `columns`, `getRowId` | required | Rows, `DataGridColumn<T>[]` (an engine column plus `sortable`, `searchable`, `align`, `format` and `hideBelow`), and a stable row id |
| `caption` | required | The grid's accessible name (`<caption>`); `captionHidden` keeps it for assistive technology only |
| `sort` | `[]` | `bind:sort`: the engine's `GridSort`, primary key first. `onSortChange` |
| `search`, `searchable` | `''`, `false` | `bind:search`; `searchable` shows a labelled search field |
| `searchPredicate` | — | `(row, query) => boolean`: your own match rule for a non-empty `search`, instead of the built-in folded substring over the searchable columns (also a `gridRows` option). It runs after `filter` and before the sort |
| `filter` | none | A `FilterNode` AST, validated by `compileFilter` (an invalid filter throws) |
| `selectable`, `selected` | `false`, `[]` | A selection column; `bind:selected` holds row ids in row order. `onSelectionChange` |
| `rowLabel` | first column's text | Names a row for its checkbox, and a `rowFocusable` row itself (`aria-label` on the `tr`) |
| `onRowActivate` | none | Enter on a body cell |
| `activateOnClick` | `false` | A pointer click on a body row also calls `onRowActivate`, except a click on a control in the row (link, button, field, label, the row checkbox) or a drag that selected text. Keep a keyboard path: Enter in `grid` mode, or a link or button in a cell in `table` mode |
| `mode` | `grid` | `grid`: the APG grid below. `table`: a static table with native table semantics (no `role="grid"`, no `aria-rowcount`/`aria-colindex`, no roving tab stop and no grid keys); the sort buttons and checkboxes stay ordinary tab stops |
| `rowFocusable` | `false` | `table` mode only: each body row is a tab stop (`tabindex="0"`, named by `rowLabel`, with a focus ring), and Enter or Space on the focused row calls `onRowActivate`. The table keeps native table semantics (no `role="grid"`, no roving cell focus); keys pressed on a control inside the row are left to that control. Ignored in `grid` mode, which activates with Enter on a cell |
| `cell` | none | Snippet `(row, column)` for custom cell content; default is the column's text |
| `empty`, `loading` | none, `false` | Empty snippet, called with `{ query, filtered }` (the search text, and whether rows exist but none matched) so it can say "No results for …"; `loading` shows a row and sets `aria-busy` |
| `pageSize`, `page` | `0` (off), `1` | Client paging: `pageSize` rows per page and `bind:page` (from 1, kept in range as rows change). `onPageChange`. A pager (Previous, "Page N of M" as a polite live region, Next) renders in a `nav` named by `labels.pagination(caption)` when there is more than one page |
| `pager` | `compact` | `numbered`: a button per page between Previous and Next (the first, the last, the current page and its neighbors, with `…` gaps), named `labels.page(n)` (`Page 3`) and `aria-current="page"` on the current one (filled, not color alone); "Page N of M" stays as a visually hidden polite live region |
| `rowClass` | none | `(row) => class` for a body row (status tints, emphasis); pair a color with text, since a class is visual only |
| `filters`, `toolbar` | none | Snippets in the toolbar row: `filters` after the search field, `toolbar` at its end (export, create…). The toolbar renders when any of `searchable`, `filters` or `toolbar` is set |
| `bulkActions` | none | Snippet shown while rows are selected (`selectable`): it receives `{ selected, rows, clear }` (every selected id and row, on every page, and a function that clears the selection), inside a group named by `labels.bulkActions` |
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
- **Breakpoint columns:** a column with `hideBelow` (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, or a width in px) leaves the grid while the viewport is narrower (`matchMedia`): its header and cells are not rendered, `aria-colcount` and the keyboard model skip it, and search and filters still read it. Every column renders during SSR and until the island mounts.
- **Status:** a polite live region reports "N of M rows" and "K selected".
- **Paging (`pageSize` > 0):**
  - The body shows one page of the filtered, searched and sorted rows; `aria-rowcount` stays the full count and `aria-rowindex` is each row's position in it.
  - The header checkbox and Shift ranges act on the rows of the page; Ctrl/Cmd + A selects (or clears) every visible row on every page; the selection survives page changes.
  - A bound page outside the range is moved back into it (and written back through `bind:page`), for example when a search leaves fewer pages.

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
| Ctrl/Cmd + A | Select every visible row (on every page when paging), or clear them when all are selected |
| Enter on a body cell | `onRowActivate(row)` |

The keys are described to assistive technology through `aria-describedby` (the `instructions` label). `aria-rowcount`, `aria-colcount`, `aria-rowindex` and `aria-colindex` are set.

## Verified

- `pnpm vitest run packages/data/tests/grid-core.test.ts`: **7 tests**.
  - Model: sort cycling and Shift keys, `aria-sort`, accent-folding search, filter then search then sort, invalid filters rejected, `cellText`, every APG key including RTL and the edges, clamping, labels.
  - Component: grid roles and counts, one tab stop, header sorting with Shift, non-sortable headers, search with the count, filter, keyboard movement, Space and Shift+Space selection, the header tri-state, Ctrl/Cmd+A, Enter activation, loading and empty states, translations, and hostile cell text kept as text.
  - Windowing: the view plus overscan renders with spacer rows for the rest, `aria-rowcount` stays the full set, scrolling moves the window, the focused row stays rendered past it, and windowed cells never wrap (the `rowSize` math).
- In the browser (Chromium, WebKit, Pixel 7; a scratch spec on port 4810), the `data-grid-core` example:
  - passes **axe** in light, dark and forced colors;
  - takes one Tab into the grid, and arrows, Enter on a header (sort) and Space (select) behave as above;
  - narrows its rows on search;
  - in the RTL grid, ArrowLeft moves to the next column.
- Visual baselines: `data-grid-core`, light and dark, on Chromium and the Pixel 7.

- Paging, row classes and snippets (G7): the "DataGrid paging, row classes and toolbar snippets (G7)" block in `grid-core.test.ts` covers the page slice, `aria-rowcount` and offset `aria-rowindex`, the pager and its live position, clamping a bound page, search shrinking the pages, `pageSize` 0, `rowClass`, the `filters` and `toolbar` snippets, page-scoped select-all, the bulk-actions context across pages, Ctrl/Cmd+A across pages and `clear()`. Example: `data-grid-paging` (axe clean in light, dark and forced colors on Chromium, WebKit and the Pixel 7 in a scratch spec on port 4937).

- Table-mode row activation (G92): the "DataGrid table mode keyboard row activation (G92)" block in `grid-core.test.ts` covers the focusable, `rowLabel`-named rows, Enter and Space activation (other keys and keys from inside the row do not), the kept table semantics, and that the option is opt-in and ignored in `grid` mode.
- Adoption gaps (G55): the "DataGrid adoption gaps (G55)" block in `grid-core.test.ts` covers pointer row activation in both modes (controls in the row never activate it, and nothing activates without `activateOnClick`), the static `table` mode (no grid role, counts, tab stops or Enter activation), `hideBelow` at three viewport widths (headers, cells and `aria-colcount`) and the `empty` snippet's `{ query, filtered }`.

## Limits

- **Windowed rows must stay single-line.** The scroll math derives positions from `rowSize`, so windowed cells never wrap at any width — their table scrolls sideways instead. A large grid can also use `@texuli/data/virtual-list`.
- **Client paging only, with the built-in pager.** Server paging stays with the host: pass one page of `rows` and render a pager. The built-in pager cannot be swapped for another one yet. No grouping in the view (`ColumnGrid` adds group headers; the engine has groups).
- **No column resizing, reordering or pinning UI.** The engine's column state supports them.
- **No cell editing.** Cells are read-only; an editable grid is a separate task.
- **Wide grids scroll inside the Table's wrapper,** which becomes a focusable, named region.

## Motion

`motion` (`layout` on by default): when the shown rows change order (a sort,
a filter, a row added or removed) they glide to their new place (FLIP through
`texuli/motion` on `@texuli/core/motion`,
[ui-motion](../../texuli/docs/ui-motion.md)). Rows carry `data-tx-row-id`
for it. Nothing plays on the first render; reduced motion, a
`MotionProvider` level of `none` and `motion={false}` commit at once. `texuli/motion` loads with `import()` only
once a mounted grid could animate a change (G86), so it never loads under
reduced motion, level `none` or `motion={false}`.
Tests: `packages/data/tests/motion.test.ts`.
