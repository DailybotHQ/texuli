<script lang="ts">
import {
  applyRowValue,
  type EditableColumn,
  EditableDataGrid,
} from '../../src/grid-editing/index.ts';

interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  active: boolean;
}

let {
  failCommit = false,
  readOnlyColumn = false,
}: {
  failCommit?: boolean;
  /** Adds a non-editable "Code" column. */
  readOnlyColumn?: boolean;
} = $props();

let rows = $state<Deal[]>([
  { id: 'd1', name: 'Harbor Notes', stage: 'Open', amount: 120, active: true },
  { id: 'd2', name: 'Lumen Atlas', stage: 'Won', amount: 45, active: false },
]);

// svelte-ignore state_referenced_locally
const columns: EditableColumn<Deal>[] = [
  ...(readOnlyColumn ? [{ key: 'id', header: 'Code', type: 'text' } as const] : []),
  { key: 'name', header: 'Deal', type: 'text', editable: true },
  {
    key: 'stage',
    header: 'Stage',
    type: 'enum',
    options: ['Open', 'Won', 'Lost'],
    editable: true,
  },
  { key: 'amount', header: 'Amount', type: 'number', editable: true },
  { key: 'active', header: 'Active', type: 'boolean', editable: true },
];

async function onCommit(row: Deal, key: string, value: unknown): Promise<void> {
  if (failCommit) throw new Error('Harbor refused the write.');
  rows = rows.map((r) => (r.id === row.id ? applyRowValue(r, key, value as never) : r));
}

function onApply(rowId: string, key: string, value: unknown): void {
  rows = rows.map((r) => (r.id === rowId ? applyRowValue(r, key, value as never) : r));
}
</script>

<EditableDataGrid
  {rows}
  {columns}
  getRowId={(row) => row.id}
  caption="Editable deals"
  {onCommit}
  {onApply}
/>
