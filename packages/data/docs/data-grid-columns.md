# Data grid column operations

**Package:** `@texuli/data` · **Import:** `import { ColumnGrid } from '@texuli/data/grid-columns'` (also from `@texuli/data`)

`ColumnGrid` is the data grid with column operations. Every pointer operation
also has a keyboard path through the column's menu.

| Operation | Pointer | Keyboard |
| --- | --- | --- |
| **Resize** | Drag a header's edge | Menu: Wider, Narrower (32 px steps) |
| **Reset width** | Double-click the header's edge | Menu: Reset width |
| **Reorder** | Drag a header | Menu: Move earlier, Move later |
| **Pin** | — | Menu: Pin to start, Pin to end, Unpin |
| **Hide** | Column chooser checkbox | Menu: Hide column, or the chooser |
| **Show** | Column chooser checkbox, Show all, Reset columns | The chooser |
| **Group** | — | Spanning group headers above the columns |

- **Pinned columns** stay in place while the grid scrolls sideways.
- **The rest of the grid** comes from grid-core: sorting, search, the filter
  AST and APG keyboard navigation (see [data-grid-core](./data-grid-core.md)).
- **State:** the column state is the grid engine's plain `ColumnState`
  (`@texuli/data/grid`), so it is safe to persist and is validated when read.

```svelte
<script lang="ts">
  import { ColumnGrid } from '@texuli/data/grid-columns';
  import type { ColumnState } from '@texuli/data/grid';

  let columnState = $state<ColumnState>([{ key: 'name', pinned: 'left' }]);
</script>

<ColumnGrid rows={deals} {columns} getRowId={(d) => d.id} caption="Pipeline"
  groups={[{ id: 'forecast', header: 'Forecast', columns: ['stage', 'amount'] }]}
  searchable bind:columnState />
```

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `rows`, `columns`, `getRowId`, `caption`, `captionHidden` | — | As in `DataGrid`. Column `width`, `minWidth` and `maxWidth` bound resizing (24 to 2,000 px). |
| `columnState` | `[]` | `bind:columnState`: order, widths, pins and visibility. Invalid input, such as unknown fields, out-of-range widths or more than 200 entries, is ignored as a whole, and the definition order shows. `onColumnStateChange` |
| `groups` | `[]` | `{ id, header, columns }[]`: one level of group headers |
| `sort`, `search`, `searchable`, `filter` | — | As in `DataGrid`. Search reads only the visible columns; the filter can use hidden ones. |
| `resizable`, `reorderable`, `pinnable`, `hideable` | `true` | Each one turns its operation off |
| `onRowActivate`, `cell`, `empty`, `loading`, `maxBlockSize`, `density`, `locale` | — | As in `DataGrid` |
| `labels` | English | Every visible and announced string (`resolveColumnGridLabels`) |

There is no selection column; `DataGrid` has one.

## Behavior

- **Pin zones:**
  - The engine's `left` and `right` pins are logical here: start and end. A
    right-to-left grid pins `left` columns on the right.
  - Columns render in three zones: start pins, unpinned, end pins.
  - Moving and dragging stay inside a zone, so pin a column to change its
    zone.
- **Sticky pins:**
  - Pinned columns stick with offsets from `pinOffsets`, and the last start
    pin and first end pin draw a boundary.
  - If the pins would take more than half of the grid's visible width (a
    phone, a narrow panel), they scroll with the rest instead (`pinsFit`,
    `data-pins="static"`), so the other columns stay reachable.
  - The width is measured on mount, and later changes apply once they hold
    for 120 ms.
- **Widths:** columns use `table-layout: fixed`, and the table is as wide as
  its columns, so a wide grid scrolls inside the Table's wrapper. Long text
  is cut with an ellipsis.
- **Resizing:**
  - Pointer: drag the inline-end edge of a header. The drag direction
    follows `dir`.
  - Keyboard: Wider and Narrower in the menu. They keep the menu open so
    they can repeat.
  - The edge is a pointer affordance only (`aria-hidden`), and the menu is
    its keyboard alternative (WCAG 2.5.7).
- **Reordering:**
  - Drag a header past 6 px, by mouse, pen or touch. A bar marks the drop
    side.
  - The click that ends a drag does not sort.
  - Headers allow vertical panning only (`touch-action: pan-y`), so a
    sideways touch drag reorders rather than scrolls.
- **Hiding:**
  - The last visible column cannot be hidden.
  - Hiding a sorted column removes its sort key.
  - The **Columns** toggle opens a chooser panel: one checkbox per column, in
    state order, plus Show all and Reset columns.
- **Group headers:** a header row of `<th scope="colgroup" colspan>` cells.
  - A group that reordering or pinning splits shows its header over each part.
  - Columns outside every group get an empty spacer.
  - The group row is not part of the keyboard grid.
  - With a capped height, both rows stick; keyboard-scrolled rows stop below
    the pair (scroll padding), not under the second one.
- **Announcements:** moves ("Deal moved to position 2 of 7"), pins, widths,
  hides and shows are announced in a polite live region.
- **Focus:** after a menu action or a drag, focus stays on the column's
  header wherever it moved.
- **Loading:** the column menu (the Menu primitive) loads after the first
  paint. Until then, the menu buttons are present but `aria-disabled`.

## Keyboard

Grid navigation is grid-core's: one tab stop, arrows (swapped in RTL),
Home/End, Ctrl/Cmd+Home/End, PageUp/PageDown, and Enter or Space to sort. On a
column header, these keys open the column menu:

| Key | Action |
| --- | --- |
| Alt + ArrowDown, Shift + F10, the Menu key | Open the column menu on its first item |

In the menu, the keys follow the Menu primitive: arrows, Home and End,
typeahead, Enter, and Escape to return to the header. Disabled items, such as
Move earlier on the first column, are skipped.

## Model

The model is framework-free and exported from the subpath:
- `parseColumnState`, `completeState`;
- `moveColumnTo` and `moveColumnBy` (zone-aware), `canMoveColumn`;
- `resizeColumnBy`, `resetColumnWidth`, `columnWidth`, `RESIZE_STEP`;
- `canHideColumn`;
- `pinOffsets`, `pinsFit`, `PIN_SHARE`, `totalWidth`;
- `headerGroups`, `dropTarget`, `orderedColumns`, `zoneOf`.

They build on the engine's `resolveColumns`, `moveColumn`, `resizeColumn`,
`pinColumn`, `setColumnHidden` and `showAllColumns`.

## Size

Measured with `pnpm size` on 2026-10-24:

| Entry | gzip | CSS | Lazy |
| --- | ---: | ---: | ---: |
| `@texuli/data/grid-columns` | 14.86 KiB | 2.54 KiB | 15.29 KiB (the column menu) |

That is over the 12 KiB `@texuli/data/*` default and within the entry's own
16 KiB budget. The entry includes the grid engine, the texuli Table and
grid-core's model; grid-core alone measures 10.63 KiB.

## Verified

- **Unit tests:** `pnpm vitest run packages/data/tests/grid-columns.test.ts`
  has 2 tests.
  - Model: state validation, completion, zone-aware moves, resize bounds and
    reset, pin offsets and `pinsFit`, group runs, drop targets including RTL,
    and the last-column guard.
  - Component: rendering from state (order, widths, pins, groups), hostile
    state, the menu from Alt+ArrowDown and Shift+F10 with move, pin, resize
    and hide, focus following the column, the chooser, pointer resize
    (including RTL), drag reorder without sorting, keyboard navigation of the
    new order, search over visible columns only, and narrow-grid pins.
  - Cohesion and sticky chrome: vector (SVG) sort indicators like grid-core's,
    and grouped grids marked so keyboard scroll padding clears both sticky
    header rows.
  - 11 deliberate code breaks each fail a test.
- **Real browsers:** a scratch Playwright spec on Chromium, WebKit and Pixel 7
  (lane N port 4950, not committed) passed:
  - axe reported no violations for both examples, and with a menu and the
    chooser open, in light and dark, with forced colors on and off;
  - keyboard menus, moves, pins and hides;
  - mouse resize and reorder;
  - pins staying put while the grid scrolls;
  - touch: a tap opens the menu, the chooser works, and a real touch drag
    reorders;
  - on the phone, the pins scroll with the rest;
  - RTL pins, arrows and resizing.
- **Visual baselines:** `data-grid-columns` and `data-grid-columns-rtl`, light
  and dark, Chromium and Pixel 7.

## Limits

- **One level** of group headers, and the group row is not keyboard-navigable.
- **No auto-fit** (size to content), and no drag to pin; pins are set from
  the menu.
- **No virtualization:** wide or long grids render every cell.
- **No selection column** in this view.
- **Firefox** was not checked (it does not launch on this machine).
