# @texuli/data

Data views for Svelte 5 applications: a data grid (with column operations,
virtualization and inline editing), a tree view, a board, a calendar, a
Gantt timeline, an offline map, an activity feed and a file browser. Each
view sits on a framework-free TypeScript engine that you can also use on its
own, in Node or behind a view of your own. It is part of
[Texuli](https://texuli.com), "Small pieces. Infinite possibilities.": an MIT
Svelte 5 component library by Dailybot, Inc., for teams building
data-heavy product screens.

> **Status: 0.x release.** `@texuli/data` is published on npm as `0.4.0`, a
> pre-1.0 release (1.0.0 will be the first stable release). Under 0.x, a new
> minor (`0.5.0`) may contain breaking changes, so pin the exact version or
> use `^0.4.0`, which accepts only 0.4.x.

## Install

```sh
npm install @texuli/data @texuli/tokens svelte
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
| `@texuli/data/grid-core` | `DataGrid`: sorting, search, filtering, row selection, client paging, toolbar and bulk-action snippets, and grid keyboard navigation |
| `@texuli/data/filter-builder` | `FilterBuilder`: nested and/or filter groups with operators by field type, plus the pure `applyFilter` |
| `@texuli/data/grid-columns` | `ColumnGrid`: resize, reorder, pin, hide, group headers and column menus |
| `@texuli/data/grid-virtual` | `VirtualDataGrid`: independent row and column windows for large tables |
| `@texuli/data/grid-editing` | `EditableDataGrid`: inline cell editors, validation, undo and redo, TSV clipboard |
| `@texuli/data/tree-view` | `TreeDataView`: outline and file-tree view with lazy children, drag reorder and checkboxes |
| `@texuli/data/board` | `Board`: columns and swimlanes with WIP limits, keyboard moves, column footers and heading levels |
| `@texuli/data/calendar/view` | `CalendarView`: month, time-grid and agenda views with move and reschedule |
| `@texuli/data/timeline` | `TimelineView`: virtualized Gantt timeline with dependencies, zoom and critical path |
| `@texuli/data/map` | `MapView`: an offline, fictional vector basemap with markers, clusters, routes and fences |
| `@texuli/data/activity` | `ActivityFeed`: day-grouped activity with avatars, reactions and pagination |
| `@texuli/data/activity/inbox` | `NotificationInbox`: unread state, mark read and unread, mark all, item actions and arrival announcements |
| `@texuli/data/cohort` | `CohortTable`: a cohort retention table with row and period headers, readable numbers and heat cells |
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
| `@texuli/data/activity/engine` | Mention tokens, day groups, change summaries, threads, reactions and inbox read state |
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

## Unreleased (planned for 0.5.0)

In the workspace, not on npm yet:

- `DataGrid`: client paging (`pageSize`, `bind:page`), `rowClass(row)`, and
  `filters`, `toolbar` and selection-aware `bulkActions` snippets
  ([data-grid-core](./docs/data-grid-core.md)).
- `Board`: a `columnFooter(column, { count })` snippet and `headingLevel`
  ([data-board](./docs/data-board.md)).
- New `@texuli/data/filter-builder`
  ([data-filter-builder](./docs/data-filter-builder.md)),
  `@texuli/data/activity/inbox`
  ([data-activity-inbox](./docs/data-activity-inbox.md)) and
  `@texuli/data/cohort` ([data-cohort](./docs/data-cohort.md)).

## New in 0.4.0

Not in the `0.3.0` release:

- **One drag engine.** The board, tree view, calendar, timeline and grid
  column moves run on
  [`@texuli/drag`](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/README.md)
  (in development, on npm as `0.4.0`; `@texuli/data` `0.3.0` predates this
  migration):
  one pointer gesture tracker (capture, threshold, `pointercancel` as
  cancel). The board and tree view also announce moves from localized
  `DragMessages` templates, overridable with their new `messages` prop.
- **Breaking:** `@texuli/data/board` and `@texuli/data/tree-view` no longer
  export `DRAG_THRESHOLD_PX` or `indexFromPointer`. The threshold lives in
  `@texuli/drag/gesture` and the pointer index in
  `@texuli/drag/collision` (`midpointIndex`).

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

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-data).
