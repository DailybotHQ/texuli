<script lang="ts">
import { VirtualDataGrid, type VirtualGridColumn } from '@texuli/data/grid-virtual';

interface RecordRow {
  id: string;
  name: string;
  owner: string;
  status: string;
  amount: number;
}
const rows: RecordRow[] = Array.from({ length: 100_000 }, (_, index) => {
  const id = index + 1;
  return {
    id: `record-${id}`,
    name: `Record ${id.toLocaleString('en-US')}`,
    owner: ['Ada Park', 'Bea Ruiz', 'Cy Moreau'][index % 3] as string,
    status: ['Open', 'In review', 'Complete'][index % 3] as string,
    amount: (id * 7919) % 250_000,
  };
});
const columns: VirtualGridColumn[] = [
  { key: 'name', header: 'Record', width: 240 },
  { key: 'owner', header: 'Owner', width: 160 },
  { key: 'status', header: 'Status', width: 160 },
  { key: 'amount', header: 'Amount', width: 140 },
  { key: 'name', header: 'Record name', width: 240 },
  { key: 'owner', header: 'Account owner', width: 180 },
  { key: 'status', header: 'Lifecycle', width: 160 },
  { key: 'amount', header: 'Value', width: 140 },
];
</script>

<section class="demo" aria-labelledby="virtual-grid-title">
  <h2 id="virtual-grid-title">100,000 fictional records</h2>
  <p>Scroll in either direction. Use arrow keys, Home, End and Page Up/Down inside the grid.</p>
  <VirtualDataGrid {rows} {columns} getRowId={(row) => (row as RecordRow).id} caption="Fictional records" />
  <p class="count">100,000 records · 8 columns</p>
</section>

<style>
  .demo { display: grid; gap: 0.75rem; padding: 1.5rem; color: var(--tx-foreground, CanvasText); }
  .demo h2, .demo p { margin: 0; }
  .count { color: var(--tx-muted-foreground, GrayText); font-size: 0.875rem; }
</style>
