<script lang="ts">
import { applyRowValue, type EditableColumn, EditableDataGrid } from '@texuli/data/grid-editing';

interface Ledger {
  id: string;
  name: string;
  owner: string;
  status: string;
  amount: number;
}

// Fictional data only.
let rows = $state.raw<Ledger[]>(
  Array.from({ length: 100_000 }, (_, index) => {
    const id = index + 1;
    return {
      id: `ledger-${id}`,
      name: `Ledger ${id}`,
      owner: ['Ada Park', 'Bea Ruiz', 'Cy Moreau'][index % 3] as string,
      status: ['Open', 'Review', 'Closed'][index % 3] as string,
      amount: (id * 7919) % 25_000,
    };
  })
);

const columns: EditableColumn<Ledger>[] = [
  { key: 'name', header: 'Ledger', type: 'text', editable: true },
  { key: 'owner', header: 'Owner', type: 'text', editable: true },
  {
    key: 'status',
    header: 'Status',
    type: 'enum',
    options: ['Open', 'Review', 'Closed'],
    editable: true,
  },
  { key: 'amount', header: 'Amount', type: 'number', editable: true },
];

function onCommit(row: Ledger, key: string, value: unknown): void {
  rows = rows.map((r) => (r.id === row.id ? applyRowValue(r, key, value as never) : r));
}
</script>

<section
  class="demo"
  data-example="data-grid-editing-virtual"
  aria-labelledby="grid-edit-virtual-title"
>
  <h2 id="grid-edit-virtual-title">100,000 editable records</h2>
  <p>
    Only the rows in view render. Arrow keys, Page Up/Down and Ctrl+Home/End move through every
    row; Enter or F2 edits the focused cell.
  </p>
  <EditableDataGrid
    {rows}
    {columns}
    getRowId={(row) => row.id}
    caption="Fictional ledgers"
    rowSize={41}
    {onCommit}
  />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
