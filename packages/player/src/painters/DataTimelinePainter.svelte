<script lang="ts">
import { TimelineView } from '@texuli/data/timeline';
import { getPlayerInteraction } from '../context.ts';

/** `data-timeline`: tasks and dependencies from JSON; the zoom is bindable. */
interface Task {
  id: string;
  title: string;
  start?: string;
  end?: string;
  progress?: number;
  group?: string;
  milestone?: boolean;
}

let {
  label,
  tasks,
  dependencies = [],
  zoom = 'week',
  locale = 'en',
  txPath,
}: {
  label: string;
  tasks: readonly Task[];
  dependencies?: readonly { from: string; to: string; type?: 'FS' | 'SS' | 'FF' | 'SF' }[];
  zoom?: 'day' | 'week' | 'month' | 'quarter';
  locale?: string;
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
let rows = $state.raw<readonly Task[]>([]);
$effect.pre(() => {
  rows = tasks;
});
let shown = $state<'day' | 'week' | 'month' | 'quarter'>('week');
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
</script>

<TimelineView
  tasks={rows}
  dependencies={dependencies.map((dependency) => ({ ...dependency, type: dependency.type ?? 'FS' }))}
  {label}
  bind:zoom={shown}
  {locale}
  getGroup={(task: Task) => (task.group ? { id: task.group, label: task.group } : undefined)}
  onReschedule={(changes) => {
    const byId = new Map(changes.map((change) => [change.id, change]));
    rows = rows.map((task) => {
      const change = byId.get(task.id);
      return change ? { ...task, ...(change.start ? { start: change.start } : {}), ...(change.end ? { end: change.end } : {}) } : task;
    });
    if (txPath !== undefined) interaction?.dispatch(txPath, 'move', { value: changes[0]?.id ?? '' });
  }}
  onOpen={(task: Task) => {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: task.id });
  }}
/>
