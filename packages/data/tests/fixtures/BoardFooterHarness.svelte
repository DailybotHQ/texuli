<script lang="ts">
import { Board } from '../../src/board/index.ts';

interface Task {
  id: string;
  title: string;
  column: string;
  lane: string;
  rank: string;
}

let { headingLevel, lanes = false }: { headingLevel?: 2 | 3 | 4 | 5 | 6; lanes?: boolean } =
  $props();

const tasks: Task[] = [
  { id: 'a', title: 'Alpha task', column: 'todo', lane: 'web', rank: 'a0' },
  { id: 'b', title: 'Beta task', column: 'todo', lane: 'web', rank: 'a1' },
  { id: 'c', title: 'Gamma task', column: 'done', lane: 'web', rank: 'a0' },
];
const columns = [
  { id: 'todo', title: 'To do' },
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
  {...headingLevel ? { headingLevel } : {}}
  getId={(task) => task.id}
  getColumn={(task) => task.column}
  getRank={(task) => task.rank}
  getLabel={(task) => task.title}
  onMove={() => {}}
>
  {#snippet card(task)}
    <span>{task.title}</span>
  {/snippet}
  {#snippet columnFooter(column, { count })}
    <button type="button">Add to {column.title} ({count})</button>
  {/snippet}
</Board>
