<script lang="ts">
import DataGrid from '../../src/grid-core/DataGrid.svelte';
import type { DataGridColumn } from '../../src/grid-core/model.ts';

type Row = { id: string; name: string };

interface Props {
  onRef: (element: HTMLElement | null) => void;
}

let { onRef }: Props = $props();
let ref = $state<HTMLElement | null>(null);
const rows: Row[] = [{ id: 'r1', name: 'Ada Example' }];
const columns: DataGridColumn<Row>[] = [{ key: 'name', header: 'Name', type: 'text' }];

$effect(() => onRef(ref));
</script>

<DataGrid
  bind:ref
  {rows}
  {columns}
  getRowId={(row: Row) => row.id}
  caption="People"
  mode="table"
  id="people-table"
  data-testid="people"
  aria-describedby="people-help"
  style="max-inline-size: 40rem"
/>
