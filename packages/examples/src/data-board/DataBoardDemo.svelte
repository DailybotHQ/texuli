<script lang="ts">
import { Board, type BoardMove } from '@texuli/data/board';

interface Task {
  id: string;
  title: string;
  detail: string;
  column: string;
  rank: string;
}

const columns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'active', title: 'In progress', wip: { soft: 2, hard: 3 } },
  { id: 'review', title: 'Review', wip: { soft: 1 } },
  { id: 'done', title: 'Done' },
];
let tasks = $state<Task[]>([
  {
    id: 'task-1',
    title: 'Map the core flow',
    detail: 'Product · 2 points',
    column: 'backlog',
    rank: 'a0',
  },
  {
    id: 'task-2',
    title: 'Build the empty state',
    detail: 'Design · 1 point',
    column: 'backlog',
    rank: 'a1',
  },
  {
    id: 'task-3',
    title: 'Review navigation',
    detail: 'Engineering · 3 points',
    column: 'active',
    rank: 'a0',
  },
  {
    id: 'task-4',
    title: 'Check keyboard paths',
    detail: 'Quality · 2 points',
    column: 'review',
    rank: 'a0',
  },
]);

function onMove(move: BoardMove): void {
  const ranks = new Map((move.rerank ?? []).map((entry) => [entry.itemId, entry.rank]));
  tasks = tasks.map((task) => {
    if (task.id === move.itemId) return { ...task, column: move.columnId, rank: move.rank };
    const rank = ranks.get(task.id);
    return rank === undefined ? task : { ...task, column: move.columnId, rank };
  });
}
</script>

<section class="demo" data-example="data-board" aria-labelledby="data-board-title" dir="ltr">
  <h2 id="data-board-title">Sprint board</h2>
  <p>
    Drag a card with its grip, use Space and the arrow keys on the grip, or open
    <strong>Move</strong> on a card and pick a column and position (keyboard and screen-reader
    alternative to dragging).
  </p>
  <Board
    {columns}
    items={tasks}
    getId={(task) => task.id}
    getColumn={(task) => task.column}
    getRank={(task) => task.rank}
    getLabel={(task) => task.title}
    {onMove}
    labels={{ board: 'Sprint board columns' }}
    class="demo-board"
  >
    {#snippet card(task)}
      <strong>{task.title}</strong>
      <span>{task.detail}</span>
    {/snippet}
  </Board>
  <section class="rtl-preview" aria-labelledby="data-board-rtl-title">
    <h3 id="data-board-rtl-title">Right-to-left preview</h3>
    <p>Board direction is set to right-to-left.</p>
    <Board
      {columns}
      items={tasks}
      getId={(task) => task.id}
      getColumn={(task) => task.column}
      getRank={(task) => task.rank}
      getLabel={(task) => task.title}
      dir="rtl"
      {onMove}
      labels={{ board: 'Right-to-left sprint board columns' }}
      class="demo-board"
    >
      {#snippet card(task)}
        <strong>{task.title}</strong>
        <span>{task.detail}</span>
      {/snippet}
    </Board>
  </section>
</section>

<style>
  .demo {
    max-inline-size: 100%;
    color: var(--tx-foreground, var(--tx-text, CanvasText));
  }
  .demo h2 { margin-block: 0 0.5rem; }
  .demo p { margin-block: 0 1rem; }
  .rtl-preview { margin-block-start: 2rem; }
  .rtl-preview h3 { margin-block: 0 0.5rem; }
  :global(.demo-board .tx-board__columns) { min-block-size: 16rem; }
  :global(.demo-board .tx-board__content strong),
  :global(.demo-board .tx-board__content span) { display: block; }
  :global(.demo-board .tx-board__content span) {
    margin-block-start: 0.25rem;
    color: var(--tx-foreground, CanvasText);
    font-size: 0.875rem;
  }
</style>
