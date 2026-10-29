# Dashboard engine

**Package:** `@texuli/data`
**Subpath:** `@texuli/data/dashboard/engine` (framework-free: no Svelte, no DOM; also re-exported by `@texuli/data/dashboard`)
**Source:** `packages/data/src/dashboard/engine/`
**Tests:** `packages/data/tests/dashboard-engine.test.ts`
**Status:** unreleased, planned for `0.8.0` (PLAN_010 T-dashboard).

Layout math for dashboards: every position is in grid units (column and row
indexes from 0), never pixels. Every operation is pure (it returns a new
layout) and refuses with a reason instead of throwing.

## Types

- `DashboardItem`: `{ id, x, y, w, h, minW?, minH?, maxW?, maxH?, locked? }`.
- `DashboardLayout`: a readonly array of items.
- `DashboardCompaction`: `'vertical'` (float up) or `'none'` (keep gaps).
- `DashboardGridOptions`: `{ columns, compaction? }`.
- `DashboardChange`: `{ ok: true, layout, item }` or `{ ok: false, reason }`
  with `DashboardRefusal`: `unknown-item`, `locked`, `edge` or `size`.
- `DashboardBreakpoint`: `{ id, minWidth, columns }`.
- `DashboardIssue`: `{ path, message }`, what reading untrusted input dropped or clamped.
- `DashboardState`: `{ format: 'texuli-dashboard', formatVersion: 1, layouts }`.

## Layout

| Function | What it does |
| --- | --- |
| `normalizeLayout(input, options)` | Reads an untrusted layout: drops entries that are not widgets and duplicate ids, caps the count, clamps every number to the grid, places widgets without `x`/`y` first-fit, resolves overlaps. Deterministic whatever the input order. Returns `{ layout, issues }` |
| `normalizeItem(input, columns)` | One untrusted widget, or `null`; `placed` says whether it had a position |
| `compactLayout(layout, compaction)` | Removes overlaps and (with `vertical`) closes gaps; locked widgets stay put |
| `moveItem(layout, id, { x, y }, options)` | Moves a widget to a cell; widgets it lands on are pushed down (or swap above it when it moves down) |
| `resizeItem(layout, id, { w, h }, options)` | Resizes within the widget's bounds and the grid; `size` when nothing can change |
| `nudgeItem(layout, id, { dx, dy }, options)` | One keyboard step; grows the step until the widget really moves, else `edge` |
| `addItem(layout, item, options)` / `removeItem(layout, id, options)` | Add (first-fit without a position) or remove a widget |
| `firstFit(layout, { w, h }, columns)` | The first free slot, scanning rows then columns |
| `overlaps(a, b)`, `compareItems(a, b)`, `sortLayout(layout)`, `layoutBottom(layout)`, `sameLayout(a, b)` | Helpers: collision, reading order, height, equality |
| `sizeBounds(item, columns)`, `defaultSize(columns)` | A widget's size bounds; the size of a widget that gives none (4 by 3) |

## Breakpoints

| Function | What it does |
| --- | --- |
| `dashboardBreakpoints(columns)` | `lg` from 1,024 px with `columns`, `md` from 640 px with at most 6, `sm` with 1 |
| `DEFAULT_DASHBOARD_BREAKPOINTS` | `dashboardBreakpoints(12)` |
| `normalizeBreakpoints(input)` | Untrusted breakpoints: unique ids, whole numbers, widest first, the last from 0 px |
| `resolveBreakpoint(width, breakpoints)` | The breakpoint for a container width |
| `reflowLayout(layout, from, to, compaction)` | Scales positions and widths onto another column count, keeping reading order |
| `layoutForBreakpoint(layouts, breakpoint, breakpoints, compaction)` | A breakpoint's own layout, else the nearest wider (then narrower) one reflowed |

## Keyboard and pointer

- `dashboardKeyIntent(event, { active, dir })` maps a key on a handle to
  `grab`, `step` (`dx`, `dy`), `drop` or `cancel` (`DashboardKeyIntent`,
  `DashboardKeyLike`); left and right flip in right-to-left text, and a
  modified key is never the dashboard's.
- `cellFromDelta(start, delta, cell, dir)` turns pointer travel into whole
  cells.

## Messages

`DashboardMessages` holds every announcement as a template with `{item}`,
`{column}`, `{row}` (1-based), `{width}`, `{height}` and `{reason}`
(`DashboardMessageValues`, `DashboardMessage`). `DEFAULT_DASHBOARD_MESSAGES`
is English; `resolveDashboardMessages(overrides)` merges a locale's
`DashboardMessagesOverrides`; `formatDashboardMessage`,
`formatDashboardRefusal` and `positionValues` fill them as plain text.

## Persistence and sync

- `serializeDashboard(layouts)` gives canonical JSON (`dashboardState`
  builds the object); `parseDashboard(input, { breakpoints, compaction })`
  reads it back as untrusted input and never throws
  (`ParseDashboardOptions`, `ParsedDashboard`).
- `diffLayout(before, after)` lists `DashboardLayoutDiff` entries (`place`
  with the widget, or `remove`), the per-widget registers a sync binding
  writes (ADR-010). The binding onto `@texuli/document/sync` itself is
  planned.

## Hostile-input bounds

`DASHBOARD_LIMITS`: 200 widgets, 24 columns, 48 rows per widget, row 4,096
as the last start row, 64-character ids (`isDashboardId`), 8 breakpoints and
512 KiB of serialized state. Inputs are clamped (`clampColumns`) before any
packing runs, so the work is at most cubic in 200 widgets and independent of
the numbers inside the layout; a test packs 10,000 stacked entries well
inside two seconds.
