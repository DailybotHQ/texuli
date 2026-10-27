# @texuli/data

Data views for Svelte 5 applications: a data grid (with column operations,
virtualization and inline editing), a tree view, a board, a calendar, a
Gantt timeline, an offline map, an activity feed and a file browser. Each
view sits on a framework-free TypeScript engine that you can also use on its
own, in Node or behind a view of your own. It is part of
[Texuli](https://texuli.com), "Small pieces. Infinite possibilities.": an MIT
Svelte 5 component library by Dailybot, Inc., for teams building
data-heavy product screens.

> **Status: preview.** `@texuli/data` is published on npm under the `next`
> dist-tag. There is no stable release yet, so install it with `@next` and
> expect the API to change between previews.

## Install

```sh
npm install @texuli/data@next @texuli/tokens@next svelte
```

- `svelte` (^5.57.2) is a peer dependency.
- The views style themselves with the Texuli `--tx-*` design tokens. Import
  the token stylesheet once in your app (installing `@texuli/tokens` directly
  lets your bundler resolve it); each view imports its own component CSS.

```css
@import '@texuli/tokens/base.css';
```

## Quick start

```svelte
<script lang="ts">
  import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';

  type Deal = { id: string; name: string; amount: number };

  const deals: Deal[] = [
    { id: 'd1', name: 'Harbor Labs', amount: 12000 },
    { id: 'd2', name: 'Northwind Example', amount: 8400 },
  ];
  const columns: DataGridColumn<Deal>[] = [
    { key: 'name', header: 'Deal', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'number' },
  ];

  let sort = $state([{ key: 'amount', direction: 'desc' as const }]);
  let selected = $state<string[]>([]);
</script>

<DataGrid
  rows={deals}
  {columns}
  getRowId={(deal) => deal.id}
  caption="Open deals"
  searchable
  selectable
  bind:sort
  bind:selected
/>
```

`caption` is required and names the grid for assistive technology. Every
visible and announced string is translatable through `labels`.

## What's inside

**Views** (Svelte components):

| Import | What it gives you |
| --- | --- |
| `@texuli/data/grid-core` | `DataGrid`: sorting, search, filtering, row selection and grid keyboard navigation |
| `@texuli/data/grid-columns` | `ColumnGrid`: resize, reorder, pin, hide, group headers and column menus |
| `@texuli/data/grid-virtual` | `VirtualDataGrid`: independent row and column windows for large tables |
| `@texuli/data/grid-editing` | `EditableDataGrid`: inline cell editors, validation, undo and redo, TSV clipboard |
| `@texuli/data/tree-view` | `TreeDataView`: outline and file-tree view with lazy children, drag reorder and checkboxes |
| `@texuli/data/board` | `Board`: columns and swimlanes with WIP limits and keyboard moves |
| `@texuli/data/calendar/view` | `CalendarView`: month, time-grid and agenda views with move and reschedule |
| `@texuli/data/timeline` | `TimelineView`: virtualized Gantt timeline with dependencies, zoom and critical path |
| `@texuli/data/map` | `MapView`: an offline, fictional vector basemap with markers, clusters, routes and fences |
| `@texuli/data/activity` | `ActivityFeed`: day-grouped activity with avatars, reactions and pagination |
| `@texuli/data/files` | `FileBrowser`: grid or list browser with breadcrumbs, previews and multi-select |
| `@texuli/data/virtual-list` | `createVirtualList` and `createInfiniteLoader` for windowed lists |

**Engines** (framework-free TypeScript, no Svelte needed):

| Import | What it gives you |
| --- | --- |
| `@texuli/data/grid` | Windowing, column state, multi-sort, grouping, a validated filter AST and saved views |
| `@texuli/data/tree` | Flattening with ARIA level and position, cycle-safe moves, indent and outdent |
| `@texuli/data/board/engine` | Fractional rank keys, grouping, WIP limits and move validation |
| `@texuli/data/calendar` | Dates in an explicit IANA zone, an RFC 5545 recurrence subset, overlap layout and rescheduling, with no date library |
| `@texuli/data/timeline/engine` | Working-day calendars, dependencies with lag, critical path and cascading moves |
| `@texuli/data/geo` | The offline map engine: Web Mercator views, clustering, geofences, distances and routes |
| `@texuli/data/activity/engine` | Mention tokens, day groups, change summaries, threads and reactions |
| `@texuli/data/files/engine` | Natural-order children, breadcrumbs, name and move checks, deterministic thumbnails |

The package root, `@texuli/data`, re-exports the main views and helpers.

## Key guarantees

- **Accessible keyboard models.** The grid follows the WAI-ARIA grid pattern
  as a single tab stop with arrow, Home and End navigation, `aria-sort` and a
  polite live region for row and selection counts; the other views have
  documented keyboard maps.
- **Plain-text cells.** Grid cells render as text (a `format` result or the
  value), never as markup.
- **Right-to-left aware.** Arrow keys swap or mirror under `dir="rtl"` in the
  grid, board, calendar, activity feed and file browser.
- **Deterministic engines.** The calendar never reads the system clock or
  time zone (you pass `today` and `now`), and grid text sorting uses an
  explicit `locale`, so results do not depend on the host machine.
- **No network from the map.** The map engine has no tiles, no geocoding
  and no real geography.
- **Your rules stay yours.** Board and calendar moves are validated in the
  engine, but persisting them, and enforcing authorization and hard limits,
  belongs to your application.

**Known limit:** fence editing on the map is not implemented yet; fences are
drawn and listed only.

## Documentation

- Site: [texuli.com](https://texuli.com) and the
  [live examples](https://texuli.com/examples/)
- Grid:
  [core](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-grid-core.md),
  [columns](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-grid-columns.md),
  [virtualization](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-grid-virtual.md),
  [editing](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-grid-editing.md),
  [editing accessibility](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-grid-edit-a11y.md),
  [virtualized editing](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-grid-edit-virtual.md)
- Views:
  [tree view](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-tree-view.md),
  [board](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-board.md),
  [calendar and rescheduling](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-calendar-reschedule.md),
  [timeline](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-timeline.md),
  [offline map](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-map.md),
  [activity feed](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-activity.md),
  [file browser](https://github.com/DailybotHQ/texuli/blob/main/packages/data/docs/data-files.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc.
