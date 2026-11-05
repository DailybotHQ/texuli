# Timeline and Gantt

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/timeline`  
**Engine:** `packages/data/src/engines/timeline/`  
**View:** `packages/data/src/timeline/`  
**Tests:** `packages/data/tests/timeline.test.ts`  
**Example:** `data-timeline`

## Goal

A time-scaled timeline / Gantt with:

- Working-day schedules, FS/SS/FF/SF dependencies and lag (engine)
- Critical path and cascade on reschedule (engine)
- Zoom (day / week / month / quarter), today line, progress, milestones
- Keyboard pickup (Space → arrows → Enter/Escape) and pointer drag
- RTL via `direction="rtl"`: bars, ticks and the today line are placed with
  logical insets, so the earliest date sits at the inline start (the right
  edge); the dependency canvas mirrors its coordinates to match
- Virtualized rows for large plans
- Collapsible groups with an optional add action, project or phase bands on
  group headers, a selected row, and vertical markers (new in `0.14.0`)

## Usage

```svelte
<script lang="ts">
  import { TimelineView, type Dependency } from '@texuli/data/timeline';

  let tasks = $state([
    { id: 'a', title: 'Design', start: '2026-02-02', end: '2026-02-06', progress: 100 },
    { id: 'b', title: 'Build', start: '2026-02-09', end: '2026-02-20', progress: 40 },
  ]);
  const dependencies: Dependency[] = [{ from: 'a', to: 'b', type: 'FS' }];
</script>

<TimelineView
  {tasks}
  {dependencies}
  now={new Date('2026-02-12T12:00:00Z')}
  getTitle={(t) => t.title}
  getProgress={(t) => t.progress}
  onReschedule={async (changes) => {
    /* persist cascade through your service */
  }}
/>
```

Pass a fixed `now` in tests and visual stories so the today line is stable.

## Groups, bands, selection and markers

New in `0.14.0`. `getGroup` already ordered rows by group; it now also opens
each group with a header row, and its descriptor can carry a `band`:

```svelte
<script lang="ts">
  import { TimelineView, type TimelineMarker } from '@texuli/data/timeline';

  let collapsed = $state<string[]>(['rollout']);
  let selectedRow = $state<string | undefined>();
  const markers: TimelineMarker[] = [
    { at: '2026-03-06', label: 'Review window ends', tone: 'warning' },
  ];
</script>

<TimelineView
  {tasks}
  {markers}
  getGroup={(task) => ({
    id: task.phase,
    label: task.phase,
    band: { start: '2026-02-02', end: '2026-02-13', label: 'Discovery phase', tone: 'info' },
  })}
  bind:collapsed
  bind:selectedRow
  onRowSelect={(task) => openSidePanel(task.id)}
  onGroupAdd={(group) => createDraft(group.id)}
/>
```

| Prop | Type | What it does |
| --- | --- | --- |
| `getGroup` | `(task) => TimelineGroup \| undefined` | `{ id, label, band? }`. With it, every group starts with a header row. Rows without a group fall in one `Ungrouped` header. |
| `collapsed` | `string[]` (bindable) | Ids of collapsed groups. Bind it, or leave it uncontrolled; `onCollapsedChange(collapsed)` reports every toggle. |
| `onGroupAdd` | `(group) => void` | Shows an add action on every group header; `group` carries its `id`, `label`, `band` and visible `items`. |
| `selectedRow` | `string` (bindable) | Id of the selected task: highlighted and marked current, even without `onRowSelect`. |
| `onRowSelect` | `(task) => void` | Makes rows selectable: the task title becomes a button, and a bar click also selects. |
| `markers` | `TimelineMarker[]` | `{ at, label, tone? }` vertical lines besides today. `at` is a civil date (the start of that day), a `Date`, or an ISO date-time (placed at its UTC time of day). |

- **Bands.** The first `band` a group's descriptor returns spans the
  group's header row from `start` to `end` (inclusive), labelled with
  `band.label` or the group label. It stays visible while the group is
  collapsed. Bands and markers widen the date range so they are never cut
  off.
- **Collapse.** Collapsing hides the group's rows in the table and on the
  canvas. Dependency arrows to hidden rows are not drawn, and the critical
  path still counts every task.
- **Tones.** `neutral`, `primary` (the band default), `info`, `success`,
  `warning` and `danger`, as on calendar events. The fill and accent come
  from the soft tokens (`--tx-<role>-soft` with the foreground ink, or
  `--tx-<role>-soft-body` when a design system sets it). Markers default to
  `neutral`.
- **Engine.** `timelineModel(...).groups` lists the visible rows by group,
  with each group's label and band. The types `TimelineGroup`,
  `TimelineBand`, `TimelineTone` and `TimelineMarker` and the `markerOffset`
  helper are exported from `@texuli/data/timeline`.

### Accessibility

- A group header is a table row with one cell (`aria-colspan="4"`). Its
  toggle is a disclosure button (`aria-expanded`). While the group is open,
  `aria-controls` lists the group's rendered task rows; while it is closed,
  the rows are removed and `aria-controls` is dropped. The add action is a
  separate button named by `labels.addToGroup(group)` ("Add to Delivery"),
  and its visible text (`labels.add`) is part of that name.
- The task list is a `table`, not a grid, so the selection is `aria-current="true"`
  rather than `aria-selected`. It sits on the selected row, its title button
  and its bar. The highlight is a token tint plus a thick inline-start edge on
  the row, which turns `Highlight` under forced colors.
- A band's visible label is hidden from assistive technology in favor of
  `labels.band(label, start, end)` with locale dates ("Pilot phase: January
  12, 2026 to January 26, 2026").
- A marker's line is a CSS border, so it is decorative. Its visible chip is
  hidden in favor of `labels.marker(label, when)` ("Review window ends, March
  6, 2026"; an instant adds its UTC time).

## Labels

Every user-facing string (toolbar, columns, notices, live announcements,
group headers, bands and markers) goes through the `labels` prop. It is a
`Partial<TimelineLabels>` merged over `DEFAULT_TIMELINE_LABELS`, whose
defaults are English. `@texuli/data` is not on the shared label dictionary
(ADR-026) yet, so the new strings (`ungrouped`, `groupCount`, `add`,
`addToGroup`, `band`, `marker`) follow the same per-component contract:

```svelte
<TimelineView
  {tasks}
  labels={{
    milestonesOnly: 'Nur Meilensteine',
    saving: 'Speichere Termine…',
    columns: { task: 'Aufgabe', start: 'Von', end: 'Bis', duration: 'Dauer' },
  }}
/>
```

Preview and bar announcements format their dates with `locale` (full month),
so keyboard users hear "Design brief preview: January 6, 2026 to January 10,
2026." rather than ISO strings.

## Engine vs view

| Layer | Import | Role |
| --- | --- | --- |
| Engine | `@texuli/data/timeline` re-exports or `../engines/timeline` | `timelineModel`, `cascade`, `criticalPath`, `workDays` |
| View | `TimelineView` | rendering, zoom, interaction |

## Tokens

Uses `--tx-border`, `--tx-foreground`, `--tx-surface`, `--tx-primary`,
`--tx-primary-foreground`, `--tx-muted`, `--tx-muted-foreground`, the
soft tone tokens (`--tx-{primary,info,success,warning,destructive}-soft`,
optional `-soft-body`), `--tx-destructive`, `--tx-destructive-foreground`
(critical bars pair the solid destructive fill with its contract foreground so
labels stay AA in every theme) and `--tx-ring`, each with system-color
fallbacks; pressed zoom and toolbar buttons keep a Highlight state under
`forced-colors: active`.

On a critical bar, progress is a 3px stripe on the block-end edge in the
contract foreground, never a tint behind the label: a tint would pull the fill
toward the label color and break AA. Under `forced-colors: active` a critical
bar is Canvas with CanvasText text and a 2px CanvasText border, and its
progress stripe opts out of forcing (`forced-color-adjust: none`) so it stays
visible. A critical bar with no progress is told apart from a normal bar by
that heavier border alone; the critical-path mark in the task list
(`labels.criticalPath`) names it for assistive technology.
