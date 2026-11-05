<script lang="ts">
import { Board, type BoardLaneDef, type BoardMove, rankBetween } from '@texuli/data/board';

interface Issue {
  id: string;
  title: string;
  column: string;
  lane: string;
  rank: string;
}

const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'In progress', wip: { soft: 3, hard: 4 } },
  { id: 'done', title: 'Done' },
];
const lanes = [
  { id: 'web', title: 'Web' },
  { id: 'mobile', title: 'Mobile' },
];
// Fictional data only.
let issues = $state<Issue[]>([
  { id: 'i1', title: 'Sign-in redirect loop', column: 'todo', lane: 'web', rank: 'a0' },
  { id: 'i2', title: 'Dark mode contrast', column: 'doing', lane: 'web', rank: 'a0' },
  { id: 'i3', title: 'Offline drafts', column: 'doing', lane: 'mobile', rank: 'a0' },
  { id: 'i4', title: 'Push opt-in copy', column: 'doing', lane: 'mobile', rank: 'a1' },
  { id: 'i5', title: 'Tablet layout', column: 'done', lane: 'mobile', rank: 'a0' },
]);
let collapsedLanes = $state<string[]>(['mobile']);
let created = 0;

function onMove(move: BoardMove): void {
  const ranks = new Map((move.rerank ?? []).map((entry) => [entry.itemId, entry.rank]));
  issues = issues.map((issue) => {
    const at = { column: move.columnId, lane: move.laneId };
    if (issue.id === move.itemId) return { ...issue, ...at, rank: move.rank };
    const rank = ranks.get(issue.id);
    return rank === undefined ? issue : { ...issue, ...at, rank };
  });
}

function add(columnId: string, lane: BoardLaneDef): void {
  const last = issues
    .filter((issue) => issue.column === columnId && issue.lane === lane.id)
    .map((issue) => issue.rank)
    .sort()
    .at(-1);
  created += 1;
  issues = [
    ...issues,
    {
      id: `new-${created}`,
      title: `New ${lane.title.toLowerCase()} issue ${created}`,
      column: columnId,
      lane: lane.id,
      rank: rankBetween(last ?? null, null),
    },
  ];
}
</script>

<section class="demo" data-example="data-board-lanes" aria-labelledby="data-board-lanes-title">
  <h2 id="data-board-lanes-title">Release board</h2>
  <p>
    Mobile starts collapsed: its cards still count toward In progress, which has reached its soft
    limit. Open it from any column.
  </p>
  <Board
    {columns}
    {lanes}
    items={issues}
    bind:collapsedLanes
    getId={(issue) => issue.id}
    getColumn={(issue) => issue.column}
    getLane={(issue) => issue.lane}
    getRank={(issue) => issue.rank}
    getLabel={(issue) => issue.title}
    {onMove}
    labels={{ board: 'Release board columns' }}
  >
    {#snippet card(issue)}
      <strong>{issue.title}</strong>
    {/snippet}
    {#snippet cellFooter(column, lane)}
      <button
        type="button"
        class="demo-add"
        aria-label="Add to {column.title}, {lane.title}"
        onclick={() => add(column.id, lane)}>+ Add</button
      >
    {/snippet}
  </Board>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 100%;
    padding: 1.5rem;
    color: var(--tx-foreground, CanvasText);
  }
  /* A grid item's automatic minimum is its content's min-content width. */
  .demo > * {
    min-inline-size: 0;
  }
  .demo h2,
  .demo p {
    margin: 0;
  }
  .demo-add {
    min-block-size: 2rem;
    padding-inline: 0.75rem;
    border: 1px dashed var(--tx-border-strong, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
</style>
