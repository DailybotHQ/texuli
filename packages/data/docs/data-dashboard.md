# Dashboard (widget grid)

**Package:** `@texuli/data`
**Lazy subpath:** `@texuli/data/dashboard` (view and engine)
**Engine:** `packages/data/src/dashboard/engine/` (framework-free, also `./dashboard/engine`, see [data-dashboard-engine.md](./data-dashboard-engine.md))
**View:** `packages/data/src/dashboard/`
**Tests:** `packages/data/tests/dashboard.test.ts`, `packages/data/tests/dashboard-ssr.test.ts`, `packages/data/tests/dashboard-engine.test.ts`
**Example:** `data-dashboard`
**Status:** unreleased, planned for `0.8.0` (PLAN_010 T-dashboard). It is not in the `@texuli/data` root barrel: import the subpath.

## Goal

A grid of widgets people arrange themselves:

- Widgets sit on whole columns and rows (`x`, `y`, `w`, `h` in grid units);
  the view paints them in **reading order** (row, then column), so DOM and
  screen-reader order always follow the grid, whatever order they were
  written in.
- **Pointer:** each widget has a move handle and a resize handle; dragging
  runs on the `@texuli/drag/gesture` tracker (4 px threshold, pointer
  capture with a fallback, `pointercancel` and Escape cancel), snapping to
  cells, and other widgets make room as the widget passes.
- **Keyboard (APG-consistent, the `@texuli/drag` contract):** Space or Enter
  on a handle picks the widget up; the arrow keys move it one column or row
  (or, on the resize handle, change its width and height); Space or Enter
  drops; Escape cancels and restores it; Tab cancels and moves on. Left and
  right flip in right-to-left text. Every step is announced in a polite live
  region with the column, row and size (`DashboardMessages`, localizable).
- **No drag needed (WCAG 2.5.7):** a click on a handle picks the widget up
  and shows an arrange toolbar (move or size buttons, Done, Cancel).
  Handles are at least 24 by 24 CSS pixels (WCAG 2.5.8).
- **Responsive breakpoints:** the container's inline size picks a grid
  (`dashboardBreakpoints(columns)`: the full grid from 1,024 px, at most 6
  columns from 640 px, one stacked column below). A breakpoint without its
  own layout reflows the nearest wider one, in reading order.
- **Persistence:** `layouts` (bindable) holds one layout per breakpoint;
  serialize it with `serializeDashboard` and read it back, as untrusted
  input, with `parseDashboard`. Texuli stores nothing itself.
- **Motion (ADR-013):** widgets glide to their new cell after a change
  through `texuli/motion` (FLIP on the Web Animations API); nothing plays on
  mount or hydration, and under reduced motion or motion level `none` the
  change commits at once.
- **Server rendering:** widgets register while the dashboard renders, so
  server HTML already holds every widget in reading order.

## Usage

```svelte
<script lang="ts">
  import {
    Dashboard,
    type DashboardLayout,
    DashboardWidget,
    parseDashboard,
    serializeDashboard,
  } from '@texuli/data/dashboard';

  // Restore what this person arranged last time (untrusted: it is normalized).
  const stored = parseDashboard(localStorage.getItem('ops-dashboard') ?? '');
  let layouts = $state<Record<string, DashboardLayout>>({ ...stored.state?.layouts });
</script>

<Dashboard
  label="Operations"
  editable
  bind:layouts
  onLayoutChange={() => localStorage.setItem('ops-dashboard', serializeDashboard(layouts))}
>
  <DashboardWidget id="signups" title="Signups" x={0} y={0} w={4} h={2}>…</DashboardWidget>
  <DashboardWidget id="revenue" title="Revenue" x={4} y={0} w={8} h={2} minW={4}>…</DashboardWidget>
  <DashboardWidget id="incidents" title="Open incidents" w={12} h={3} locked>…</DashboardWidget>
</Dashboard>
```

A widget without `x` and `y` takes the first free slot.

## `Dashboard` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | required | Accessible name of the dashboard region |
| `layout` | `DashboardLayout` | widgets' own places | The widest grid's layout (bindable): a change made at the widest breakpoint is written back |
| `layouts` | `Record<string, DashboardLayout>` | `{}` | Saved layouts by breakpoint id; they win over `layout` (bindable) |
| `columns` | `number` | `12` | Columns of the widest grid (1 to 24); shapes the default breakpoints |
| `breakpoints` | `DashboardBreakpoint[]` | `dashboardBreakpoints(columns)` | Widest first; normalized |
| `breakpoint` | `string` | measured | Force a breakpoint id (printing, previews, tests) |
| `rowHeight` | `number` | `80` | Row height in CSS pixels (24 to 480) |
| `gap` | `'none' \| 'small' \| 'medium' \| 'large'` | `'medium'` | Space between widgets |
| `editable` | `boolean` | `false` | Shows the move and resize handles |
| `compaction` | `'vertical' \| 'none'` | `'vertical'` | `vertical` floats widgets up; `none` keeps gaps |
| `headingLevel` | `number` | `3` | Heading level of the widget titles (2 to 6) |
| `onLayoutChange` | `(layout, { breakpoint, widget, layouts }) => void` | — | After every committed move or resize |
| `messages` | `DashboardMessagesOverrides` | English | Announcement templates |
| `labels` | `DashboardLabelOverrides` | English | Handle, toolbar and empty-state text (`DEFAULT_DASHBOARD_LABELS`) |
| `motion` | `MotionProp` | layout glide | `false` turns it off |
| `dir` | `'ltr' \| 'rtl'` | inherited | Flips the inline arrows and drags |
| `class` | `ClassValue` | — | |

`DashboardLabels` (`DashboardLabelOverrides` is a partial of it): `moveHandle`,
`resizeHandle`, `toolbar` (functions of the title), `moveLeft`, `moveRight`,
`moveUp`, `moveDown`, `narrower`, `wider`, `shorter`, `taller`, `done`,
`cancel` and `empty`.

## `DashboardWidget` props

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Stable id (letters, digits, `-`, `_`; at most 64): the widget's key in every layout |
| `title` | `string` | Visible heading; it also names the handles |
| `x`, `y`, `w`, `h` | `number` | Where it starts on the widest grid when no layout knows it |
| `minW`, `minH`, `maxW`, `maxH` | `number` | Size bounds |
| `locked` | `boolean` | Never moves or resizes; nothing is pushed through it |
| `children` | `Snippet` | The content |

A `DashboardWidget` paints nothing where it is written: it registers with
the enclosing dashboard through context (`DashboardContext`,
`DashboardWidgetEntry`), which paints it. Outside a dashboard it paints its
content in place.

## Accessibility

- A named region; widgets are a list in reading order; each title is a
  heading.
- Handles are buttons with `aria-describedby` instructions and
  `aria-pressed` while picked up; no `aria-grabbed`.
- Focus stays on the handle as the widget moves; the live region announces
  pick up, every step, refusals (a locked widget in the way, an edge, a size
  limit), the drop and a cancel.
- Logical CSS only; forced colors keep borders, handles and the picked-up
  outline visible.

## Agents (spec 0.8.0)

Agents build dashboards as data with the `data-dashboard` and
`data-dashboard-widget` catalog ids: widget content is ordinary catalog
nodes, and a widget's data comes only from a host-registered source
(`{"$source": name, …}`, `@texuli/core/data-source`), never a URL or code.
The dashboard's `layout` prop may be bound to a list state or read from a
host source, so the player persists what people arrange
([player data sources](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/data-sources.md)).
`@texuli/catalog` checks the composition (widgets only directly in a
dashboard, unique ids, at most 200 widgets).

## Not built yet

- A sync binding onto `@texuli/document/sync` (ADR-010: a sequence of
  widgets with register layouts) is **planned**: `@texuli/data` does not
  depend on `@texuli/document` yet. The engine already gives a binding what
  it needs: `diffLayout` (one register per widget) and a deterministic
  `normalizeLayout`, so every replica that projects the same widgets paints
  the same grid.
- Adding and removing widgets from the view (the engine has `addItem` and
  `removeItem`) is left to the host.
