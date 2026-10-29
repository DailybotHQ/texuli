<script lang="ts">
import { Board, type BoardMove, rankBetween } from '@texuli/data/board';

interface Ticket {
  id: string;
  title: string;
  column: string;
  rank: string;
}

const columns = [
  { id: 'new', title: 'New' },
  { id: 'triaged', title: 'Triaged' },
  { id: 'closed', title: 'Closed' },
];
// Fictional data only.
let tickets = $state<Ticket[]>([
  { id: 't1', title: 'Login link expired', column: 'new', rank: 'a0' },
  { id: 't2', title: 'Export is slow', column: 'triaged', rank: 'a0' },
  { id: 't3', title: 'Typo on pricing', column: 'closed', rank: 'a0' },
]);
let created = 0;

function onMove(move: BoardMove): void {
  tickets = tickets.map((ticket) =>
    ticket.id === move.itemId ? { ...ticket, column: move.columnId, rank: move.rank } : ticket
  );
}

function add(columnId: string): void {
  const last = tickets
    .filter((ticket) => ticket.column === columnId)
    .map((ticket) => ticket.rank)
    .sort()
    .at(-1);
  created += 1;
  tickets = [
    ...tickets,
    {
      id: `new-${created}`,
      title: `New ticket ${created}`,
      column: columnId,
      rank: rankBetween(last ?? null, null),
    },
  ];
}
</script>

<section class="demo" data-example="data-board-footer" aria-labelledby="data-board-footer-title">
  <h2 id="data-board-footer-title">Support queue</h2>
  <section aria-labelledby="data-board-footer-sub">
    <h3 id="data-board-footer-sub">This week</h3>
    <Board
      {columns}
      items={tickets}
      headingLevel={4}
      getId={(ticket) => ticket.id}
      getColumn={(ticket) => ticket.column}
      getRank={(ticket) => ticket.rank}
      getLabel={(ticket) => ticket.title}
      {onMove}
      labels={{ board: 'Support queue columns' }}
    >
      {#snippet card(ticket)}
        <strong>{ticket.title}</strong>
      {/snippet}
      {#snippet columnFooter(column, { count })}
        <button type="button" class="demo-add" onclick={() => add(column.id)}>
          Add to {column.title}
        </button>
        <span class="demo-count">{count} {count === 1 ? 'ticket' : 'tickets'}</span>
      {/snippet}
    </Board>
  </section>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 100%;
    padding: 1.5rem;
    color: var(--tx-foreground, CanvasText);
  }
  /* A grid item's automatic minimum is its content's min-content width (the board's
     columns): without this the board's section, and the page, grew on a phone. */
  .demo > * {
    min-inline-size: 0;
  }
  .demo h2,
  .demo h3 {
    margin: 0 0 0.5rem;
  }
  .demo-add {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px dashed var(--tx-border-strong, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, ButtonFace);
    color: var(--tx-surface-foreground, ButtonText);
    font: inherit;
  }
  .demo-count {
    display: block;
    margin-block-start: 0.375rem;
    font-size: 0.875rem;
  }
</style>
