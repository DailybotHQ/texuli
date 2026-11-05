<script lang="ts">
import {
  type TimelineGroup,
  type TimelineMarker,
  type TimelineTone,
  TimelineView,
} from '@texuli/data/timeline';
import { getPlayerInteraction } from '../context.ts';

/**
 * `data-timeline`: tasks and dependencies from JSON. Spec 0.12.0 adds group
 * headers with bands (`groups`, keyed by each task's `group`), markers, and
 * the bindable `collapsed` and `selectedRow`. The zoom, the collapsed groups
 * and the selected row write back when bound; a toggle runs `on.collapse`
 * with the group id, and a row selection `on.select` with the task id.
 */
interface Task {
  id: string;
  title: string;
  start?: string;
  end?: string;
  progress?: number;
  group?: string;
  milestone?: boolean;
}
interface Group {
  id: string;
  label: string;
  band?: { start: string; end: string; label?: string; tone?: string };
}
type Zoom = 'day' | 'week' | 'month' | 'quarter';

let {
  label,
  tasks,
  dependencies = [],
  zoom = 'week',
  locale = 'en',
  groups = [],
  collapsed = [],
  selectedRow,
  markers = [],
  txPath,
}: {
  label: string;
  tasks: readonly Task[];
  dependencies?: readonly { from: string; to: string; type?: 'FS' | 'SS' | 'FF' | 'SF' }[];
  zoom?: Zoom;
  locale?: string;
  groups?: readonly Group[];
  collapsed?: readonly { id: string }[];
  selectedRow?: string;
  markers?: readonly { at: string; label: string; tone?: string }[];
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
const TONES = new Set(['neutral', 'primary', 'info', 'success', 'warning', 'danger']);
const toneOf = (tone: string | undefined): TimelineTone | undefined =>
  tone !== undefined && TONES.has(tone) ? (tone as TimelineTone) : undefined;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: string): boolean =>
  DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00Z`));
const instantOf = (at: string): number =>
  at.length === 10 ? (isDay(at) ? Date.parse(`${at}T00:00Z`) : Number.NaN) : Date.parse(at);

let rows = $state.raw<readonly Task[]>([]);
$effect.pre(() => {
  rows = tasks;
});
let shown = $state<Zoom>('week');
$effect.pre(() => {
  shown = zoom;
});
let lastZoom: string | undefined;
$effect(() => {
  const current = shown;
  if (lastZoom !== undefined && current !== lastZoom && txPath !== undefined) {
    interaction?.write(txPath, 'zoom', current);
    interaction?.dispatch(txPath, 'change', { value: current });
  }
  lastZoom = current;
});

// Group headers: a task group with an entry takes its label and its band
// (only a band with real dates, start before end); without one, the group
// is its own label.
const headers = $derived(
  new Map(
    groups.map((group): [string, TimelineGroup] => {
      const band = group.band;
      const valid = band && isDay(band.start) && isDay(band.end) && band.start <= band.end;
      const tone = toneOf(band?.tone);
      return [
        group.id,
        {
          id: group.id,
          label: group.label,
          ...(valid
            ? {
                band: {
                  start: band.start,
                  end: band.end,
                  ...(band.label ? { label: band.label } : {}),
                  ...(tone ? { tone } : {}),
                },
              }
            : {}),
        },
      ];
    })
  )
);
const groupOf = (task: Task): TimelineGroup | undefined =>
  task.group ? (headers.get(task.group) ?? { id: task.group, label: task.group }) : undefined;

// Markers with a date or an instant that parses; anything else is dropped.
const lines = $derived(
  markers
    .filter((marker) => Number.isFinite(instantOf(marker.at)))
    .map((marker): TimelineMarker => {
      const tone = toneOf(marker.tone);
      return { at: marker.at, label: marker.label, ...(tone ? { tone } : {}) };
    })
);

let folded = $state<string[]>([]);
let lastFolded: readonly string[] = [];
$effect.pre(() => {
  const ids = collapsed.map((item) => item.id);
  folded = ids;
  lastFolded = ids;
});
function onCollapsedChange(next: string[]): void {
  const before = new Set(lastFolded);
  const toggled = next.find((id) => !before.has(id)) ?? lastFolded.find((id) => !next.includes(id));
  lastFolded = [...next];
  if (txPath === undefined || toggled === undefined) return;
  interaction?.write(
    txPath,
    'collapsed',
    next.map((id) => ({ id }))
  );
  interaction?.dispatch(txPath, 'collapse', { value: toggled });
}

// Rows are selectable once selectedRow is set or bound ('' selects none).
let selected = $state<string | undefined>();
$effect.pre(() => {
  selected = selectedRow;
});
const selectable = $derived(selectedRow !== undefined);
function onRowSelect(task: Task): void {
  if (txPath === undefined) return;
  interaction?.write(txPath, 'selectedRow', task.id);
  interaction?.dispatch(txPath, 'select', { value: task.id });
}
</script>

<TimelineView
  tasks={rows}
  dependencies={dependencies.map((dependency) => ({ ...dependency, type: dependency.type ?? 'FS' }))}
  {label}
  bind:zoom={shown}
  {locale}
  getGroup={groupOf}
  bind:collapsed={folded}
  {onCollapsedChange}
  bind:selectedRow={selected}
  onRowSelect={selectable ? onRowSelect : undefined}
  markers={lines}
  onReschedule={(changes) => {
    const byId = new Map(changes.map((change) => [change.id, change]));
    rows = rows.map((task) => {
      const change = byId.get(task.id);
      return change ? { ...task, ...(change.start ? { start: change.start } : {}), ...(change.end ? { end: change.end } : {}) } : task;
    });
    if (txPath !== undefined) interaction?.dispatch(txPath, 'move', { value: changes[0]?.id ?? '' });
  }}
  onOpen={(task: Task) => {
    // A selectable scheduled row already ran on.select through onRowSelect.
    if (selectable && task.start && task.end) return;
    if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: task.id });
  }}
/>
