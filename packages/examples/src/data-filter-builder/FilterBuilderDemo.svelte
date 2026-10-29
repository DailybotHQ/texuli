<script lang="ts">
import {
  applyFilter,
  FilterBuilder,
  type FilterGroup,
  pruneFilter,
} from '@texuli/data/filter-builder';
import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';

interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  renewal: boolean;
  closes: string;
}

// Fictional data only.
const deals: Deal[] = [
  {
    id: 'd1',
    name: 'Harbor Notes renewal',
    stage: 'Won',
    amount: 12000,
    renewal: true,
    closes: '2026-01-15',
  },
  {
    id: 'd2',
    name: 'Lumen Atlas pilot',
    stage: 'Open',
    amount: 4500,
    renewal: false,
    closes: '2026-03-02',
  },
  {
    id: 'd3',
    name: 'Quill & Pine expansion',
    stage: 'Lost',
    amount: 900,
    renewal: false,
    closes: '2026-02-10',
  },
  {
    id: 'd4',
    name: 'Café Ñandú rollout',
    stage: 'Open',
    amount: 30000,
    renewal: false,
    closes: '2026-04-20',
  },
  {
    id: 'd5',
    name: 'Northwind Labs seats',
    stage: 'Open',
    amount: 7800,
    renewal: true,
    closes: '2026-05-08',
  },
];
const columns: DataGridColumn<Deal>[] = [
  { key: 'name', header: 'Deal', type: 'text' },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won', 'Lost'] },
  { key: 'amount', header: 'Amount', type: 'number' },
  { key: 'renewal', header: 'Renewal', type: 'boolean' },
  { key: 'closes', header: 'Closes', type: 'date' },
];

let model = $state<FilterGroup>({
  type: 'group',
  op: 'and',
  children: [
    { type: 'condition', field: 'stage', operator: 'eq', value: 'Open' },
    {
      type: 'group',
      op: 'or',
      children: [
        { type: 'condition', field: 'amount', operator: 'between', value: [5000, 50000] },
        { type: 'condition', field: 'renewal', operator: 'eq', value: true },
      ],
    },
  ],
});
const runnable = $derived(pruneFilter(model, columns));
const count = $derived(applyFilter(deals, model, columns).length);
</script>

<section class="demo" data-example="data-filter-builder" aria-labelledby="data-filter-builder-title">
  <h2 id="data-filter-builder-title">Filter deals</h2>
  <p>
    Tab through the controls; each condition has a field, an operator and a value fitting the
    field's type. Adding moves focus to the new condition, removing returns it to the group.
  </p>
  <FilterBuilder fields={columns} bind:value={model} labels={{ builder: 'Deal filters' }} />
  <p>{count} of {deals.length} deals match.</p>
  <DataGrid
    rows={deals}
    {columns}
    getRowId={(deal) => deal.id}
    caption="Matching deals"
    filter={runnable}
    density="compact"
  />
  <details>
    <summary>Saved model (JSON)</summary>
    <pre>{JSON.stringify(model, null, 2)}</pre>
  </details>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 56rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo p {
    margin: 0;
  }
  .demo pre {
    overflow: auto;
    max-block-size: 16rem;
    font-size: 0.8125rem;
  }
</style>
