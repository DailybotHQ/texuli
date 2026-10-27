# Editable grid row windowing

**Package:** `@texuli/data`  
**Subpaths:** `@texuli/data/grid-editing` (`EditableDataGrid`), `@texuli/data/grid-core` (`DataGrid`)  
**Tests:** `packages/data/tests/grid-edit-virtual.test.ts` (component), `tests/e2e/data.spec.ts` (browser, the data grid test)  
**Example:** `data-grid-editing-virtual` (100,000 fictional rows)

## Goal

An editable grid with 100,000 rows renders only the rows in view, so it no
longer runs out of memory. Inline editing, the active cell and keyboard
navigation keep working across the full set.

## Usage

```svelte
<EditableDataGrid {rows} {columns} getRowId={(row) => row.id} caption="Ledgers" {onCommit} />
```

Windowing turns on by itself above 1000 visible rows (after search and
filter). Set `rowSize` to your rows' real height for the closest scroll
math (the default density is about 41 px):

```svelte
<EditableDataGrid {rows} {columns} getRowId={(row) => row.id} caption="Ledgers" rowSize={41} {onCommit} />
```

## Props

The same names as `VirtualDataGrid`, plus a threshold. `EditableDataGrid`
passes them to `DataGrid`, which accepts them too.

| Prop | `EditableDataGrid` default | `DataGrid` default | Meaning |
| --- | --- | --- | --- |
| `virtualizeAbove` | `1000` | off (`Infinity`) | Window the rows once more than this many are visible. |
| `rowSize` | `36` | `36` | Row height in px used for the scroll math. |
| `viewportHeight` | `360` | `360` | Height of the scroll area in px (`maxBlockSize` wins when set). |
| `overscanRows` | `4` | `4` | Extra rows rendered above and below the view. |

## Behavior

- **Rendered rows:** the rows in view, plus `overscanRows` above and below,
  plus the active cell's row when it is out of view. Spacer rows
  (`aria-hidden`) stand in for the rest, so the scroll bar covers every row.
- **Scroll area:** while windowing, the grid caps its height at
  `viewportHeight` (unless `maxBlockSize` is set) and keeps the header
  sticky.
- **Edits:** pending, optimistic and error state is keyed by row id, so a
  saved or pending value is still shown when its row scrolls back in.
- **Open editor:** the active row stays rendered, so an open editor keeps
  its draft and focus while the grid scrolls away and back.
- **Keyboard:**
  - **Arrow keys, Page Up/Down and Ctrl+Home/End** move through the full
    set. Page Up/Down moves a viewport of rows minus one.
  - **Enter or F2** edits the cell focus reached. Before this change, a
    cell reached with the arrow keys didn't start editing on Enter or F2.
  - **Ctrl+Home** (and any move to the header) scrolls the body back to
    the top.
- **Sticky header:** rows reached with the keyboard stop below it
  (`scroll-padding-block-start: 2.75rem` on the sticky scroll area).
- **ARIA:** `aria-rowcount` is the visible row count plus the header, and
  every rendered row keeps its true `aria-rowindex`.

## Measured size

`pnpm size`, gzip ("After" re-measured unchanged on 2026-10-24):

| Subpath | Before | After | Cap |
| --- | --- | --- | --- |
| `@texuli/data/grid-core` | 10.09 KiB | 10,882 B (10.63 KiB) | 12 KiB |
| `@texuli/data/grid-editing` | 14.35 KiB | 15,318 B (14.96 KiB) | 15,360 B |

`grid-editing` has 42 B of headroom left.

## Limits

- **Row height:** one size for every row. Taller rows, such as wrapped
  text or a validation message, still render in full. The spacers use
  `rowSize`, so the scroll bar is approximate, and fewer rows than
  expected may fill the view when real rows are taller than `rowSize`.
- **Columns:** they are not windowed. Use `VirtualDataGrid` for very wide,
  read-only tables.
- **Find in page:** the browser's find can't reach rows that aren't
  rendered. Use the grid's search instead.
- **Selection:** "select all" and Shift ranges work on the full visible
  set; only rendering is windowed.
