<script lang="ts">
import type { MotionLevel, MotionProp } from 'texuli/motion';
import { MotionProvider } from 'texuli/motion';
import { Board } from '../../src/board/index.ts';
import { DataGrid, type DataGridColumn } from '../../src/grid-core/index.ts';

interface Task {
  id: string;
  title: string;
  column: string;
  rank: string;
}

let {
  kind,
  tasks = [],
  sortDir = 'asc',
  level = 'full',
  reducedMotion,
  motion,
}: {
  kind: 'grid' | 'board';
  tasks?: Task[];
  sortDir?: 'asc' | 'desc';
  level?: MotionLevel;
  reducedMotion?: boolean;
  motion?: MotionProp;
} = $props();

const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'In progress' },
];
const gridColumns: DataGridColumn<Task>[] = [{ key: 'title', header: 'Title', type: 'text' }];
</script>

<MotionProvider {level} {reducedMotion}>
  {#if kind === 'grid'}
    <DataGrid
      rows={tasks}
      columns={gridColumns}
      getRowId={(task) => task.id}
      caption="Tasks"
      sort={[{ key: 'title', direction: sortDir }]}
      {motion}
    />
  {:else}
    <Board
      {columns}
      items={tasks}
      getId={(task) => task.id}
      getColumn={(task) => task.column}
      getRank={(task) => task.rank}
      getLabel={(task) => task.title}
      onMove={() => {}}
      {motion}
    >
      {#snippet card(task)}<span>{task.title}</span>{/snippet}
    </Board>
  {/if}
</MotionProvider>
