<script lang="ts">
/**
 * /motion-page/ layout: the Board from @texuli/data. A committed move, from
 * a drag, the keyboard, the Move menu or the button below, makes the cards
 * glide to their new place (`layout`, on by default).
 */
import { Board, type BoardMove } from '@texuli/data/board';
import { MotionProvider } from 'texuli/motion';
import { MOTION_SETTINGS, providerReduced } from './settings.svelte.ts';

interface Card {
  id: string;
  title: string;
  column: string;
}

const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
];
const ORDER = columns.map((column) => column.id);

let cards = $state<Card[]>([
  { id: 'c1', title: 'Audit the forms', column: 'todo' },
  { id: 'c2', title: 'Dark mode pass', column: 'todo' },
  { id: 'c3', title: 'CSV export', column: 'todo' },
  { id: 'c4', title: 'Search index', column: 'doing' },
  { id: 'c5', title: 'Onboarding emails', column: 'done' },
]);
let status = $state('');

function onMove(move: BoardMove): void {
  cards = cards.map((card) =>
    card.id === move.itemId ? { ...card, column: move.columnId } : card
  );
}

/** Move the first card that is not done one column on (the end of that column). */
function advance(): void {
  const card = cards.find((entry) => entry.column !== 'done');
  if (!card) {
    cards = cards.map((entry, index) => ({ ...entry, column: index < 3 ? 'todo' : entry.column }));
    status = 'Three cards went back to To do.';
    return;
  }
  const column = ORDER[ORDER.indexOf(card.column) + 1] ?? 'done';
  cards = [...cards.filter((entry) => entry.id !== card.id), { ...card, column }];
  status = `${card.title} moved to ${columns.find((entry) => entry.id === column)?.title}.`;
}
</script>

<MotionProvider level={MOTION_SETTINGS.level} reducedMotion={providerReduced()}>
  <div class="board-demo" data-motion-board="">
    <div class="board-demo__bar">
      <button type="button" onclick={advance}>Advance a card</button>
      <p role="status" data-motion-board-status="">{status}</p>
    </div>
    <Board
      {columns}
      items={cards}
      getId={(card) => card.id}
      getColumn={(card) => card.column}
      getLabel={(card) => card.title}
      {onMove}
      labels={{ board: 'Release board' }}
      headingLevel={4}
      density="compact"
    >
      {#snippet card(card)}
        <span>{card.title}</span>
      {/snippet}
    </Board>
  </div>
</MotionProvider>

<style>
  .board-demo {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
    overflow-x: auto;
  }
  .board-demo__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .board-demo__bar p {
    margin: 0;
    font-size: 0.8125rem;
  }
  button {
    min-block-size: 2.25rem;
    padding-inline: 0.85rem;
    border: 1px solid var(--tx-border, ButtonText);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
