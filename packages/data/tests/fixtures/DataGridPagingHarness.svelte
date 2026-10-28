<script lang="ts">
import { DataGrid, type DataGridColumn } from '../../src/grid-core/index.ts';

interface Item {
  id: string;
  name: string;
  status: 'ok' | 'late';
  amount: number;
}

interface Props {
  pageSize?: number;
  page?: number;
  search?: string;
  selected?: string[];
}

let {
  pageSize = 3,
  page = $bindable(1),
  search = $bindable(''),
  selected = $bindable([]),
}: Props = $props();

const rows: Item[] = Array.from({ length: 7 }, (_, index) => ({
  id: `r${index + 1}`,
  name: `Item ${index + 1}`,
  status: index % 3 === 0 ? 'late' : 'ok',
  amount: (index + 1) * 10,
}));

const columns: DataGridColumn<Item>[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'amount', header: 'Amount', type: 'number' },
];
let exported = $state(0);
</script>

<DataGrid
  {rows}
  {columns}
  getRowId={(row) => row.id}
  caption="Items"
  searchable
  selectable
  {pageSize}
  bind:page
  bind:search
  bind:selected
  rowClass={(row) => (row.status === 'late' ? 'is-late' : undefined)}
>
  {#snippet filters()}
    <button type="button" data-testid="filter-chip">Late only</button>
  {/snippet}
  {#snippet toolbar()}
    <button type="button" onclick={() => exported++}>Export</button>
  {/snippet}
  {#snippet bulkActions({ selected: ids, rows: picked, clear })}
    <span data-testid="bulk-count">{ids.length} picked: {picked.map((row) => row.name).join(', ')}</span>
    <button type="button" onclick={clear}>Clear selection</button>
  {/snippet}
</DataGrid>
<output data-testid="paging">{JSON.stringify({ page, selected, exported })}</output>
