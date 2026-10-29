<script lang="ts">
import { Board, type BoardMove } from '../../src/board/index.ts';

// G67 (column descriptions, a column header snippet) and G69 (a board with
// no rank field: column-only mode, the host keeps its own order).

interface Ticket {
  id: string;
  title: string;
  column: string;
}

let tickets = $state<Ticket[]>([
  { id: 'a', title: 'Alpha ticket', column: 'todo' },
  { id: 'b', title: 'Beta ticket', column: 'todo' },
  { id: 'c', title: 'Gamma ticket', column: 'done' },
]);
let moves = $state<BoardMove[]>([]);
const columns = [
  { id: 'todo', title: 'To do', description: 'Tickets nobody has started.' },
  { id: 'done', title: 'Done' },
];

function onMove(move: BoardMove): void {
  moves = [...moves, move];
  // The host stores only the column: no rank.
  tickets = tickets.map((ticket) =>
    ticket.id === move.itemId ? { ...ticket, column: move.columnId } : ticket
  );
}
</script>

<Board
  {columns}
  items={tickets}
  getId={(ticket) => ticket.id}
  getColumn={(ticket) => ticket.column}
  getLabel={(ticket) => ticket.title}
  {onMove}
>
  {#snippet card(ticket)}
    <span>{ticket.title}</span>
  {/snippet}
  {#snippet columnHeader(column, { count })}
    <button type="button" data-testid="header-{column.id}">Sort {column.title} ({count})</button>
  {/snippet}
</Board>
<output data-testid="moves">{JSON.stringify(moves.map((move) => [move.itemId, move.columnId]))}</output>
