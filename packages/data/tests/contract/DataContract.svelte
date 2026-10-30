<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Board } from '../../src/board/index.ts';

interface Task {
  id: string;
  title: string;
  column: string;
}

let { p, refs }: HarnessProps = $props();
const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'done', title: 'Done' },
];
const tasks: Task[] = [{ id: 'alpha', title: 'Alpha task', column: 'todo' }];
</script>

<Board
  {columns}
  items={tasks}
  getId={(task: Task) => task.id}
  getColumn={(task: Task) => task.column}
  getLabel={(task: Task) => task.title}
  onMove={() => undefined}
  motion={false}
  {...p('Board')}
  bind:ref={refs.Board}
>
  {#snippet card(task: Task)}<span>{task.title}</span>{/snippet}
</Board>
