<script lang="ts">
import type { DragMessagesOverrides } from '@texuli/drag/messages';
import { Board, type BoardLabelOverrides, type BoardMove } from '../../src/board/index.ts';

interface Task {
  id: string;
  title: string;
  column: string;
  rank: string;
}

let {
  lockedIds = [] as string[],
  labels,
  messages,
  failMoves = false,
}: {
  lockedIds?: string[];
  labels?: BoardLabelOverrides;
  messages?: DragMessagesOverrides;
  /** The host's save fails, so the board restores the card. */
  failMoves?: boolean;
} = $props();

let tasks = $state<Task[]>([
  { id: 'alpha', title: 'Alpha task', column: 'todo', rank: 'a0' },
  { id: 'beta', title: 'Beta task', column: 'doing', rank: 'a0' },
]);
let moves = $state<BoardMove[]>([]);
const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'In progress', wip: { hard: 1 } },
  { id: 'done', title: 'Done' },
];

function onMove(move: BoardMove): void {
  if (failMoves) throw new Error('Fictional save failure');
  moves = [...moves, move];
  const ranks = new Map((move.rerank ?? []).map((entry) => [entry.itemId, entry.rank]));
  tasks = tasks.map((task) => {
    if (task.id === move.itemId) {
      return { ...task, column: move.columnId, rank: move.rank };
    }
    const rank = ranks.get(task.id);
    return rank === undefined ? task : { ...task, column: move.columnId, rank };
  });
}
</script>

<Board
  {columns}
  items={tasks}
  dir="rtl"
  getId={(task) => task.id}
  getColumn={(task) => task.column}
  getRank={(task) => task.rank}
  getLabel={(task) => task.title}
  isLocked={(task) => lockedIds.includes(task.id)}
  {labels}
  {messages}
  {onMove}
>
  {#snippet card(task)}
    <span>{task.title}</span>
  {/snippet}
</Board>
<output aria-label="Move count">{moves.length}</output>
