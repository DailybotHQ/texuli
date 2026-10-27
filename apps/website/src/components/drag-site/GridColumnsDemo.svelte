<script lang="ts">
import type { ColumnState } from '@texuli/data/grid';
import { ColumnGrid } from '@texuli/data/grid-columns';
import type { DataGridColumn } from '@texuli/data/grid-core';

/**
 * Grid columns on the same engine: drag a header to reorder it inside its
 * pin zone, drag its edge to resize. The column menu offers the same moves
 * from the keyboard (WCAG 2.5.7).
 */

type Deal = { id: string; account: string; owner: string; stage: string; amount: number };

const rows: Deal[] = [
  { id: 'd1', account: 'Harbor Notes', owner: 'Ada Park', stage: 'Won', amount: 12_400 },
  { id: 'd2', account: 'Lumen Labs', owner: 'Bea Ruiz', stage: 'Open', amount: 4_500 },
  { id: 'd3', account: 'Quill & Co', owner: 'Ada Park', stage: 'Open', amount: 900 },
  { id: 'd4', account: 'Orbit Supply', owner: 'Cy Lee', stage: 'Lost', amount: 2_250 },
];

const columns: DataGridColumn<Deal>[] = [
  { key: 'account', header: 'Account', type: 'text', width: 180 },
  { key: 'owner', header: 'Owner', type: 'text', width: 140 },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won', 'Lost'], width: 120 },
  { key: 'amount', header: 'Amount', type: 'number', width: 120 },
];

let columnState = $state<ColumnState>([{ key: 'account', pinned: 'left' }]);
</script>

<ColumnGrid
  {rows}
  {columns}
  getRowId={(row: Deal) => row.id}
  caption="Fictional deals"
  bind:columnState
  maxBlockSize="18rem"
/>
