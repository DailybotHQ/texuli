<script lang="ts">
import {
  type Dependency,
  type TaskChange,
  type TimelineBand,
  type TimelineMarker,
  TimelineView,
} from '@texuli/data/timeline';

interface DemoTask {
  id: string;
  title: string;
  start?: string;
  end?: string;
  milestone?: boolean;
  progress?: number;
  group?: string;
}

let tasks = $state<DemoTask[]>([
  {
    id: 'brief',
    title: 'Write product brief',
    start: '2026-02-02',
    end: '2026-02-06',
    progress: 100,
    group: 'Discovery',
  },
  {
    id: 'design',
    title: 'Design flows',
    start: '2026-02-09',
    end: '2026-02-13',
    progress: 70,
    group: 'Discovery',
  },
  {
    id: 'build',
    title: 'Build timeline view',
    start: '2026-02-16',
    end: '2026-02-27',
    progress: 35,
    group: 'Delivery',
  },
  {
    id: 'launch',
    title: 'Launch review',
    start: '2026-03-02',
    end: '2026-03-02',
    milestone: true,
    group: 'Delivery',
  },
  {
    id: 'pilot',
    title: 'Pilot with two teams',
    start: '2026-03-02',
    end: '2026-03-05',
    group: 'Rollout',
  },
  {
    id: 'docs',
    title: 'Publish help center',
    start: '2026-03-06',
    end: '2026-03-10',
    group: 'Rollout',
  },
  {
    id: 'parking',
    title: 'Parking-lot idea',
    group: 'Backlog',
  },
]);

const dependencies: Dependency[] = [
  { from: 'brief', to: 'design', type: 'FS' },
  { from: 'design', to: 'build', type: 'FS' },
  { from: 'build', to: 'launch', type: 'FS' },
  { from: 'launch', to: 'pilot', type: 'FS' },
  { from: 'pilot', to: 'docs', type: 'FS' },
];

// Project bands: one phase per group, drawn on the group's header row.
const bands: Record<string, TimelineBand> = {
  Discovery: { start: '2026-02-02', end: '2026-02-13', label: 'Discovery phase', tone: 'info' },
  Delivery: { start: '2026-02-16', end: '2026-03-02', label: 'Delivery phase', tone: 'success' },
  Rollout: { start: '2026-03-02', end: '2026-03-10', label: 'Rollout phase', tone: 'neutral' },
};
const markers: TimelineMarker[] = [
  { at: '2026-03-06', label: 'Review window ends', tone: 'warning' },
];

let direction = $state<'ltr' | 'rtl'>('ltr');
let collapsed = $state<string[]>(['rollout']);
let selectedRow = $state<string | undefined>('design');
let drafts = 0;

function addTask(group: { label: string }): void {
  drafts += 1;
  // A draft has no dates yet, so it waits in the Unscheduled tray.
  tasks = [
    ...tasks,
    { id: `draft-${drafts}`, title: `New ${group.label} task`, group: group.label },
  ];
  lastSave = `Added a draft to ${group.label}.`;
}
let lastSave = $state('No changes yet.');

async function onReschedule(changes: readonly TaskChange[]): Promise<void> {
  const byId = new Map(changes.map((change) => [change.id, change]));
  tasks = tasks.map((task) => {
    const change = byId.get(task.id);
    if (!change?.start || !change.end) return task;
    return { ...task, start: change.start, end: change.end };
  });
  lastSave = `Saved ${changes.length} change${changes.length === 1 ? '' : 's'}.`;
}
</script>

<section data-example="data-timeline" aria-labelledby="timeline-demo-title">
  <header class="head">
    <div>
      <h2 id="timeline-demo-title">Timeline and Gantt</h2>
      <p>
        Fictional launch plan with phase bands, collapsible groups, a selected row, a
        review-window marker, dependencies, zoom, critical path and keyboard rescheduling.
        Drag a bar or focus it and press Space, then arrows.
      </p>
    </div>
    <label>
      Direction
      <select bind:value={direction} aria-label="Timeline direction">
        <option value="ltr">LTR</option>
        <option value="rtl">RTL</option>
      </select>
    </label>
  </header>
  <TimelineView
    {tasks}
    {dependencies}
    {direction}
    now={new Date('2026-02-18T12:00:00Z')}
    label="Northwind launch"
    getTitle={(task) => task.title}
    getProgress={(task) => task.progress}
    getGroup={(task) =>
      task.group
        ? { id: task.group.toLowerCase(), label: task.group, band: bands[task.group] }
        : undefined}
    {markers}
    bind:collapsed
    bind:selectedRow
    onRowSelect={(task) => (lastSave = `Opened ${task.title} in the side panel.`)}
    onGroupAdd={addTask}
    onReschedule={onReschedule}
  />
  <p class="save" role="status">
    {lastSave} Selected row: {tasks.find((task) => task.id === selectedRow)?.title ?? 'none'}.
  </p>
</section>

<style>
  section {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
  }
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    max-inline-size: 40rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
  }
  select {
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.375rem;
    padding-block: 0.35rem;
    padding-inline: 0.5rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
  }
  .save {
    font-size: 0.875rem;
  }
</style>
