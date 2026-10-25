# @texuli/data

**Layer L4: data.** Data views: grid, tree, board, calendar, timeline, map,
activity and files — each a framework-free engine (in `src/engines/`) with a
Svelte 5 view on top. Private workspace package (`"private": true`), not
published.

## What exists today

Every area has source in `src/` and a unit test in `tests/`; most areas have
a doc in [`docs/`](docs/) with per-feature limits. Engine subpaths are
framework-free TypeScript, usable without the views.

| Area | View | Subpaths | What it is |
| --- | --- | --- | --- |
| Grid | `DataGrid.svelte` | `./grid-core`, `./grid` (engine), `./grid-columns`, `./grid-virtual` | The core data grid, the column model with column menus, and the virtualized variant. |
| Editable grid | `EditableDataGrid.svelte` | `./grid-editing` | Cell editing with an undo stack and cell validation; a11y and virtualized editing have their own docs and tests. |
| Tree | `TreeDataView.svelte` | `./tree-view`, `./tree` (engine) | The tree data view on the tree engine. |
| Board | `Board.svelte` | `./board`, `./board/engine` | The board view on the board engine. |
| Calendar | `CalendarView.svelte` (month, time-grid and agenda views) | `./calendar/view`, `./calendar` (engine) | Month, time-grid and agenda views with move and reschedule. |
| Timeline | `TimelineView.svelte` | `./timeline`, `./timeline/engine` | Timeline and Gantt view on the timeline engine. |
| Map | `MapView.svelte` | `./map`, `./geo` (engine) | The offline map view. Fence **editing is deferred**: the host seams exist, vertex handles are not implemented. |
| Activity | `ActivityFeed.svelte` | `./activity`, `./activity/engine` | The activity feed on the activity engine. |
| Files | `FileBrowser.svelte` | `./files`, `./files/engine` | The file browser on the files engine. |
| Virtual list | — | `./virtual-list` | Windowed list rendering with an infinite loader, as a standalone subpath. |

Docs: [data-grid-core](docs/data-grid-core.md),
[data-grid-columns](docs/data-grid-columns.md),
[data-grid-editing](docs/data-grid-editing.md),
[data-grid-edit-a11y](docs/data-grid-edit-a11y.md),
[data-grid-edit-virtual](docs/data-grid-edit-virtual.md),
[data-calendar-reschedule](docs/data-calendar-reschedule.md),
[data-timeline](docs/data-timeline.md),
[data-map](docs/data-map.md) (deferred fence editing),
[data-tree-view](docs/data-tree-view.md),
[data-activity](docs/data-activity.md),
[data-files](docs/data-files.md).

## Testing

```bash
pnpm vitest run packages/data
pnpm --filter @texuli/data typecheck
npx biome check packages/data
pnpm size --filter data
```
