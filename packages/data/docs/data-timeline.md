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
- RTL via `direction="rtl"` and logical CSS
- Virtualized rows for large plans

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

## Engine vs view

| Layer | Import | Role |
| --- | --- | --- |
| Engine | `@texuli/data/timeline` re-exports or `../engines/timeline` | `timelineModel`, `cascade`, `criticalPath`, `workDays` |
| View | `TimelineView` | rendering, zoom, interaction |

## Tokens

Uses `--tx-border`, `--tx-foreground`, `--tx-surface`, `--tx-primary`,
`--tx-destructive`, `--tx-ring` with system-color fallbacks for forced colors.
