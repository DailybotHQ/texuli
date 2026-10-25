<script lang="ts">
import { applyRowValue, type EditableColumn, EditableDataGrid } from '@texuli/data/grid-editing';

interface Deal {
  id: string;
  name: string;
  owner: string;
  stage: string;
  amount: number;
  active: boolean;
}

// Fictional data only.
let rows = $state<Deal[]>([
  {
    id: 'd1',
    name: 'Harbor Notes renewal',
    owner: 'Ada Park',
    stage: 'Open',
    amount: 1200,
    active: true,
  },
  {
    id: 'd2',
    name: 'Lumen Atlas pilot',
    owner: 'Bea Ruiz',
    stage: 'Won',
    amount: 450,
    active: true,
  },
  {
    id: 'd3',
    name: 'Quill & Pine expansion',
    owner: 'Cy Moreau',
    stage: 'Lost',
    amount: 90,
    active: false,
  },
]);

const columns: EditableColumn<Deal>[] = [
  { key: 'name', header: 'Deal', type: 'text', editable: true },
  { key: 'owner', header: 'Owner', type: 'text', editable: true },
  {
    key: 'stage',
    header: 'Stage',
    type: 'enum',
    options: ['Open', 'Won', 'Lost'],
    editable: true,
  },
  {
    key: 'amount',
    header: 'Amount ($)',
    type: 'number',
    editable: true,
    format: (value) =>
      value === null || value === undefined ? '' : Number(value).toLocaleString('en-US'),
  },
  { key: 'active', header: 'Active', type: 'boolean', editable: true },
];

function onCommit(row: Deal, key: string, value: unknown): void {
  rows = rows.map((r) => (r.id === row.id ? applyRowValue(r, key, value as never) : r));
}

function onApply(rowId: string, key: string, value: unknown): void {
  rows = rows.map((r) => (r.id === rowId ? applyRowValue(r, key, value as never) : r));
}
</script>

<section class="demo" data-example="data-grid-editing" aria-labelledby="grid-edit-title">
  <h2 id="grid-edit-title">Editable data grid</h2>
  <p>
    Double-click a cell or press Enter / F2 to edit. Escape cancels. Undo and Redo sit above the
    grid. Copy and paste use TSV. Fictional Harbor deals only.
  </p>
  <EditableDataGrid
    {rows}
    {columns}
    getRowId={(row) => row.id}
    caption="Harbor deals"
    searchable
    {onCommit}
    {onApply}
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
