<script lang="ts">
import { Board, type BoardMove, placementsOf, rankSequence } from '@texuli/data/board';
import { getPlayerInteraction } from '../context.ts';

/**
 * `data-board`: cards in columns from plain JSON. A move updates the cards
 * in view, writes them back when `items` is bound (or saves them through
 * the host's data source when `items` reads one), and runs `on.move`.
 */
interface Card {
  id: string;
  title: string;
  column: string;
  lane?: string;
  rank?: string;
  detail?: string;
  locked?: boolean;
}

let {
  label,
  columns,
  items,
  lanes,
  density = 'comfortable',
  txPath,
}: {
  label: string;
  columns: readonly { id: string; title: string; wipSoft?: number; wipHard?: number }[];
  items: readonly Card[];
  lanes?: readonly { id: string; title: string }[];
  density?: 'comfortable' | 'compact';
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
let cards = $state.raw<readonly Card[]>([]);
$effect.pre(() => {
  // Cards without a rank keep their list order.
  const ranks = rankSequence(items.length);
  cards = items.map((card, i) => (card.rank ? card : { ...card, rank: ranks[i] as string }));
});
const columnDefs = $derived(
  columns.map((column) => ({
    id: column.id,
    title: column.title,
    ...(column.wipSoft !== undefined || column.wipHard !== undefined
      ? {
          wip: {
            ...(column.wipSoft !== undefined ? { soft: column.wipSoft } : {}),
            ...(column.wipHard !== undefined ? { hard: column.wipHard } : {}),
          },
        }
      : {}),
  }))
);

async function onMove(move: BoardMove): Promise<void> {
  const placements = placementsOf(move);
  const next = cards.map((card) => {
    const placed = placements[card.id];
    if (!placed) return card;
    const { lane: _lane, ...rest } = card;
    return {
      ...rest,
      column: placed.columnId,
      rank: placed.rank,
      ...(placed.laneId ? { lane: placed.laneId } : {}),
    };
  });
  cards = next;
  if (txPath === undefined) return;
  // Items read from a host data source (spec 0.8.0) are saved through it: the
  // board shows the move at once and puts the card back if the source refuses.
  const saved = interaction?.save?.(txPath, 'items', next) ?? null;
  if (saved === null) interaction?.write(txPath, 'items', next);
  interaction?.dispatch(txPath, 'move', { value: move.itemId });
  if (saved) await saved;
}
</script>

{#snippet card(item: Card)}
  <span class="tx-player-board-card">
    <strong>{item.title}</strong>
    {#if item.detail}<small>{item.detail}</small>{/if}
  </span>
{/snippet}

<section class="tx-player-data" aria-label={label}>
  <Board
    {card}
    columns={columnDefs}
    items={cards}
    lanes={lanes ?? []}
    getId={(card: Card) => card.id}
    getColumn={(card: Card) => card.column}
    getLane={(card: Card) => card.lane ?? ''}
    getRank={(card: Card) => card.rank ?? ''}
    getLabel={(card: Card) => card.title}
    isLocked={(card: Card) => card.locked === true}
    {onMove}
    {density}
  />
</section>

<style>
  .tx-player-board-card {
    display: grid;
    gap: 0.125rem;
  }

  .tx-player-board-card small {
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
