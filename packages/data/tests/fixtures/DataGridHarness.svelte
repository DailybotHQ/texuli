<script lang="ts">
import type { GridSort } from '../../src/engines/grid/sort.ts';
import { DataGrid, type DataGridColumn } from '../../src/grid-core/index.ts';

export interface Deal {
  id: string;
  name: string;
  owner: string;
  stage: string;
  amount: number;
  closes: string;
}

interface Props {
  rows?: Deal[];
  sort?: GridSort;
  search?: string;
  selected?: string[];
  filter?: unknown;
  selectable?: boolean;
  searchable?: boolean;
  loading?: boolean;
  activated?: string[];
  labels?: Record<string, unknown>;
}

const DEALS: Deal[] = [
  {
    id: 'd1',
    name: 'Harbor Notes renewal',
    owner: 'Ada',
    stage: 'won',
    amount: 12000,
    closes: '2026-01-15',
  },
  {
    id: 'd2',
    name: 'Lumen Atlas pilot',
    owner: 'Bea',
    stage: 'open',
    amount: 4500,
    closes: '2026-03-02',
  },
  {
    id: 'd3',
    name: 'Quill & Pine',
    owner: 'Ada',
    stage: 'lost',
    amount: 900,
    closes: '2026-02-10',
  },
  { id: 'd4', name: 'Café Ñandú', owner: 'Cy', stage: 'open', amount: 30000, closes: '2026-04-20' },
];

let {
  rows = DEALS,
  sort = $bindable([]),
  search = $bindable(''),
  selected = $bindable([]),
  filter,
  selectable = true,
  searchable = true,
  loading = false,
  activated = [],
  labels = {},
}: Props = $props();

const columns: DataGridColumn<Deal>[] = [
  { key: 'name', header: 'Deal', type: 'text' },
  { key: 'owner', header: 'Owner', type: 'text' },
  {
    key: 'stage',
    header: 'Stage',
    type: 'enum',
    options: ['open', 'won', 'lost'],
    sortable: false,
  },
  {
    key: 'amount',
    header: 'Amount',
    type: 'number',
    format: (value) => `$${Number(value).toLocaleString('en-US')}`,
  },
  { key: 'closes', header: 'Closes', type: 'date' },
];
</script>

<DataGrid
  {rows}
  {columns}
  getRowId={(row) => row.id}
  caption="Deals"
  bind:sort
  bind:search
  bind:selected
  {filter}
  {selectable}
  {searchable}
  {loading}
  {labels}
  onRowActivate={(row) => activated.push(row.id)}
/>
<output data-testid="state">{JSON.stringify({ sort, search, selected })}</output>
