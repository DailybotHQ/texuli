<script lang="ts">
import { Board, type BoardLabelOverrides } from '../../src/board/index.ts';

interface Task {
  id: string;
  title: string;
  column: string;
  lane: string;
  rank: string;
}

let {
  lanes = true,
  collapsed = [],
  labels,
  onCollapsedLanesChange,
}: {
  lanes?: boolean;
  collapsed?: string[];
  labels?: BoardLabelOverrides;
  onCollapsedLanesChange?: (collapsedLanes: string[]) => void;
} = $props();

// Fictional data only.
let tasks = $state<Task[]>([
  { id: 'a', title: 'Alpha task', column: 'todo', lane: 'web', rank: 'a0' },
  { id: 'b', title: 'Beta task', column: 'todo', lane: 'api', rank: 'a0' },
  { id: 'c', title: 'Gamma task', column: 'done', lane: 'api', rank: 'a0' },
]);
// svelte-ignore state_referenced_locally
let collapsedLanes = $state<string[]>(collapsed);
const columns = [
  { id: 'todo', title: 'To do', wip: { soft: 1, hard: 2 } },
  { id: 'done', title: 'Done' },
];
const laneDefs = [
  { id: 'web', title: 'Web' },
  { id: 'api', title: 'API' },
];
</script>

<Board
  {columns}
  items={tasks}
  {...lanes ? { lanes: laneDefs, getLane: (task: Task) => task.lane } : {}}
  bind:collapsedLanes
  {onCollapsedLanesChange}
  {labels}
  getId={(task) => task.id}
  getColumn={(task) => task.column}
  getRank={(task) => task.rank}
  getLabel={(task) => task.title}
  onMove={(move) => {
    tasks = tasks.map((task) =>
      task.id === move.itemId
        ? { ...task, column: move.columnId, lane: move.laneId, rank: move.rank }
        : task
    );
  }}
>
  {#snippet card(task)}
    <span>{task.title}</span>
  {/snippet}
  {#snippet cellFooter(column, lane)}
    <button type="button" data-testid="cell-footer">Add to {column.id}/{lane.id}</button>
  {/snippet}
  {#snippet columnFooter(column, { count })}
    <span data-testid="column-footer">{column.id} ({count})</span>
  {/snippet}
</Board>
<output data-testid="collapsed">{collapsedLanes.join(',')}</output>
