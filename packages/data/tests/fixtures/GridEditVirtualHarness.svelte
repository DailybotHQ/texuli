<script lang="ts">
import {
  applyRowValue,
  type EditableColumn,
  EditableDataGrid,
} from '../../src/grid-editing/index.ts';

interface Record {
  id: string;
  name: string;
  amount: number;
}

let {
  count = 100_000,
  hold = false,
  readOnlyColumn = false,
}: {
  count?: number;
  /** Adds a non-editable "Code" column. */
  readOnlyColumn?: boolean;
  /** Keep each commit pending until `window.releaseCommit()` runs. */
  hold?: boolean;
} = $props();

// Fictional records only.
// svelte-ignore state_referenced_locally
let rows = $state.raw<Record[]>(
  Array.from({ length: count }, (_, index) => ({
    id: `r${index + 1}`,
    name: `Record ${index + 1}`,
    amount: index + 1,
  }))
);

// svelte-ignore state_referenced_locally
const columns: EditableColumn<Record>[] = [
  ...(readOnlyColumn ? [{ key: 'id', header: 'Code', type: 'text' } as const] : []),
  { key: 'name', header: 'Record', type: 'text', editable: true },
  { key: 'amount', header: 'Amount', type: 'number', editable: true },
];

async function onCommit(row: Record, key: string, value: unknown): Promise<void> {
  if (hold) {
    await new Promise<void>((resolve) => {
      (globalThis as { releaseCommit?: () => void }).releaseCommit = resolve;
    });
  }
  rows = rows.map((r) => (r.id === row.id ? applyRowValue(r, key, value as never) : r));
}
</script>

<EditableDataGrid
  {rows}
  {columns}
  getRowId={(row) => row.id}
  caption="Fictional records"
  {onCommit}
/>
