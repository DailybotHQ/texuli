# Virtual data grid

**Package:** `@texuli/data` · **Import:** `import { VirtualDataGrid } from '@texuli/data/grid-virtual'`

A read-only grid with independent row and column windows: 100,000 rows and a
wide table stay bounded to the cells in view. The engine
(`virtualGridWindow`, `moveVirtualCell`) is framework-free; the Svelte view
ships in the same subpath.

## Usage

```svelte
<script lang="ts">
  import { VirtualDataGrid, type VirtualGridColumn } from '@texuli/data/grid-virtual';

  const rows = Array.from({ length: 100_000 }, (_, index) => ({
    id: `r${index + 1}`,
    name: `Record ${index + 1}`,
  }));
  const columns: VirtualGridColumn[] = [
    { key: 'name', header: 'Record', width: 240 },
    { key: 'id', header: 'ID', width: 120 },
  ];
</script>

<VirtualDataGrid
  {rows}
  {columns}
  getRowId={(row) => row.id}
  caption="Fictional records"
/>
```

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `rows` / `columns` / `getRowId` | — | Data, columns (`key`, `header`, `width?`) and the stable row id. |
| `caption` | — | The grid's accessible name (`aria-label`, not rendered as a visible caption). |
| `rowSize` | `36` | Row height in px used for the scroll math. |
| `overscanRows` / `overscanColumns` | `4` / `2` | Extra rows and columns rendered outside the view. |
| `viewportHeight` / `viewportWidth` | `360` / `640` | Fallback viewport sizes until the first measurement. |
| `cellValue` | — | Custom text for a cell; by default the row's property as text (dates as ISO day). |

## Behavior

- **Two windows:** only the rows and columns in view render, so the DOM stays
  small for any row and column count. The canvas keeps the full scroll size
  (`aria-rowcount` includes the header row).
- **Keyboard (APG grid, `aria-activedescendant`):** arrows move one cell
  (left and right swap in RTL), Home and End go to the row's first and last
  cell, **Ctrl/Cmd+Home and Ctrl/Cmd+End go to the first and last body cell**
  (the header row is not addressable), PageUp and PageDown move a viewport of
  rows. The grid root is the single tab stop.
- **Active cell:** the active cell carries a visible outline
  (`--tx-ring`, `Highlight` under forced colors) so keyboard users can see
  where they are; it is also the `aria-activedescendant` target.
- **RTL:** horizontal movement, scroll math and `scrollLeft` signs follow the
  resolved `direction`.
- **Truncation:** cells clip with an ellipsis by design (`text-overflow`);
  widen the column or shorten the value instead of expecting wrapping.
- **Themes:** every color goes through the `--tx-*` contract with system-color
  fallbacks; `forced-colors: active` keeps the border, focus and active-cell
  outlines on `CanvasText`/`Highlight`.

## Tests

- `packages/data/tests/grid-virtual.test.ts` (engine windows, keyboard map,
  RTL, unique ids across instances, active-cell marking).
- Example: `data-grid-virtual` (100,000 records, 8 columns).

## Limits

- **Read-only:** no sorting, search, selection or editing. Use `DataGrid`
  (or `EditableDataGrid`) for those; rows there window above a threshold
  while columns stay whole.
- **Fixed row height:** one `rowSize` for every row; taller content is
  clipped, not measured.
- **Caption:** the caption names the grid for assistive technology only;
  add your own heading when a visible title is needed (the example does).
