<script lang="ts">
import { DataGrid } from '@texuli/data/grid-core';
import { getPlayerInteraction } from '../context.ts';

/** `data-grid`: rows of display strings under typed columns. */
interface Row {
  id: string;
  cells: Readonly<Record<string, string>>;
}

let {
  caption,
  columns,
  rows,
  searchable = false,
  selectable = false,
  density = 'default',
  txPath,
}: {
  caption: string;
  columns: readonly {
    id: string;
    header: string;
    kind?: 'text' | 'number' | 'date';
    align?: 'start' | 'center' | 'end';
    sortable?: boolean;
  }[];
  rows: readonly Row[];
  searchable?: boolean;
  selectable?: boolean;
  density?: 'compact' | 'default' | 'comfortable';
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
// Number columns sort by value; the cell string stays what people read.
const columnDefs = $derived(
  columns.map((column) => ({
    key: column.id,
    header: column.header,
    type: column.kind ?? ('text' as const),
    accessor: (row: Row) => {
      const text = row.cells[column.id] ?? '';
      if (column.kind === 'number') {
        const value = Number(text.replace(/[^0-9.+-]/g, ''));
        return Number.isFinite(value) && text.trim() !== '' ? value : null;
      }
      return text;
    },
    format: (_value: unknown, row: Row) => row.cells[column.id] ?? '',
    ...(column.align ? { align: column.align } : {}),
    ...(column.sortable !== undefined ? { sortable: column.sortable } : {}),
  }))
);
</script>

<DataGrid
  {rows}
  columns={columnDefs}
  getRowId={(row: Row) => row.id}
  {caption}
  {searchable}
  {selectable}
  {density}
  onSelectionChange={(selected: string[]) => {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: selected[selected.length - 1] ?? '' });
  }}
  onSortChange={() => {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'change');
  }}
/>
