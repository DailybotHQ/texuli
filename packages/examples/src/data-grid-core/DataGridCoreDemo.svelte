<script lang="ts">
import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';

interface Deal {
  id: string;
  name: string;
  owner: string;
  stage: string;
  amountCents: number;
  closes: string;
}

// Fictional data only.
const deals: Deal[] = [
  {
    id: 'd1',
    name: 'Harbor Notes renewal',
    owner: 'Ada Park',
    stage: 'Won',
    amountCents: 1_200_000,
    closes: '2026-01-15',
  },
  {
    id: 'd2',
    name: 'Lumen Atlas pilot',
    owner: 'Bea Ruiz',
    stage: 'Open',
    amountCents: 450_000,
    closes: '2026-03-02',
  },
  {
    id: 'd3',
    name: 'Quill & Pine expansion',
    owner: 'Ada Park',
    stage: 'Lost',
    amountCents: 90_000,
    closes: '2026-02-10',
  },
  {
    id: 'd4',
    name: 'Café Ñandú rollout',
    owner: 'Cy Moreau',
    stage: 'Open',
    amountCents: 3_000_000,
    closes: '2026-04-20',
  },
  {
    id: 'd5',
    name: 'Northwind Labs seats',
    owner: 'Bea Ruiz',
    stage: 'Open',
    amountCents: 780_000,
    closes: '2026-05-08',
  },
  {
    id: 'd6',
    name: 'Orbit Desk upgrade',
    owner: 'Cy Moreau',
    stage: 'Won',
    amountCents: 220_000,
    closes: '2026-01-28',
  },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const columns: DataGridColumn<Deal>[] = [
  { key: 'name', header: 'Deal', type: 'text' },
  { key: 'owner', header: 'Owner', type: 'text' },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won', 'Lost'] },
  {
    key: 'amountCents',
    header: 'Amount',
    type: 'number',
    format: (value) => money.format(Number(value) / 100),
  },
  { key: 'closes', header: 'Closes', type: 'date' },
];

let sort = $state([{ key: 'amountCents', direction: 'desc' as const }]);
let selected = $state<string[]>(['d2']);
const openOnly = { type: 'condition', field: 'stage', operator: 'eq', value: 'Open' };

const arabicColumns: DataGridColumn<Deal>[] = [
  { key: 'name', header: 'الصفقة', type: 'text' },
  { key: 'owner', header: 'المالك', type: 'text' },
  {
    key: 'amountCents',
    header: 'المبلغ',
    type: 'number',
    format: (value) => money.format(Number(value) / 100),
  },
];
</script>

<section class="demo" data-example="data-grid-core" aria-labelledby="data-grid-title">
  <h2 id="data-grid-title">Data grid</h2>
  <p>
    Tab into the grid, then use the arrow keys, Home and End. Enter or Space on a header sorts it
    (Shift adds a key); Space selects a row.
  </p>

  <h3>Deals: search, sort and selection</h3>
  <DataGrid
    rows={deals}
    {columns}
    getRowId={(deal) => deal.id}
    caption="Deals"
    searchable
    selectable
    bind:sort
    bind:selected
    maxBlockSize="22rem"
  />

  <h3>Open deals only (filter)</h3>
  <DataGrid
    rows={deals}
    {columns}
    getRowId={(deal) => deal.id}
    caption="Open deals"
    filter={openOnly}
    density="compact"
  />

  <h3>Right to left</h3>
  <div dir="rtl" lang="ar">
    <DataGrid
      rows={deals.slice(0, 3)}
      columns={arabicColumns}
      getRowId={(deal) => deal.id}
      caption="الصفقات"
      selectable
      labels={{
        selectAll: 'تحديد كل الصفوف',
        selectRow: (label) => `تحديد ${label}`,
        selection: 'التحديد',
        rowCount: (count, total) => `${count} من ${total}`,
        selectedCount: (count) => `${count} محدد`,
        instructions: 'استخدم الأسهم للتنقل بين الخلايا.',
      }}
    />
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 56rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo h3,
  .demo p {
    margin: 0;
  }
</style>
