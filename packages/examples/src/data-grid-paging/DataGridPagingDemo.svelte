<script lang="ts">
import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';

interface Invoice {
  id: string;
  customer: string;
  status: 'Paid' | 'Due' | 'Overdue';
  amountCents: number;
  due: string;
}

// Fictional data only.
const customers = ['Harbor Notes', 'Lumen Atlas', 'Quill & Pine', 'Orbit Desk', 'Northwind Labs'];
const statuses: Invoice['status'][] = ['Paid', 'Due', 'Overdue', 'Paid', 'Due'];
const invoices: Invoice[] = Array.from({ length: 23 }, (_, index) => ({
  id: `inv-${1001 + index}`,
  customer: customers[index % customers.length] ?? 'Example customer',
  status: statuses[(index * 3) % statuses.length] ?? 'Due',
  amountCents: 12_000 + ((index * 7919) % 90_000),
  due: `2026-${String(1 + (index % 9)).padStart(2, '0')}-${String(3 + (index % 24)).padStart(2, '0')}`,
}));

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const columns: DataGridColumn<Invoice>[] = [
  { key: 'id', header: 'Invoice', type: 'text' },
  { key: 'customer', header: 'Customer', type: 'text' },
  { key: 'status', header: 'Status', type: 'enum', options: ['Paid', 'Due', 'Overdue'] },
  {
    key: 'amountCents',
    header: 'Amount',
    type: 'number',
    format: (value) => money.format(Number(value) / 100),
  },
  { key: 'due', header: 'Due', type: 'date' },
];

let page = $state(1);
let pageSize = $state(5);
let selected = $state<string[]>([]);
let overdueOnly = $state(false);
let lastAction = $state('');
const filter = $derived(
  overdueOnly ? { type: 'condition', field: 'status', operator: 'eq', value: 'Overdue' } : undefined
);
</script>

<section class="demo" data-example="data-grid-paging" aria-labelledby="data-grid-paging-title">
  <h2 id="data-grid-paging-title">Paging and bulk actions</h2>
  <p>
    Pages of five rows: the header checkbox selects this page, Control or Command plus A selects
    every row, and the selection stays while you change pages.
  </p>
  <DataGrid
    rows={invoices}
    {columns}
    getRowId={(invoice) => invoice.id}
    caption="Invoices"
    searchable
    selectable
    {filter}
    bind:page
    {pageSize}
    bind:selected
    rowClass={(invoice) => (invoice.status === 'Overdue' ? 'is-overdue' : undefined)}
  >
    {#snippet filters()}
      <label class="demo-check">
        <input type="checkbox" bind:checked={overdueOnly} />
        Overdue only
      </label>
      <label class="demo-check">
        Rows per page
        <select bind:value={pageSize}>
          <option value={5}>5</option>
          <option value={10}>10</option>
        </select>
      </label>
    {/snippet}
    {#snippet toolbar()}
      <button type="button" class="demo-button" onclick={() => (lastAction = 'Exported every invoice.')}>
        Export
      </button>
    {/snippet}
    {#snippet bulkActions({ selected: ids, clear })}
      <span>{ids.length} selected</span>
      <button
        type="button"
        class="demo-button"
        onclick={() => {
          lastAction = `Sent ${ids.length} reminders.`;
          clear();
        }}>Send reminders</button
      >
      <button type="button" class="demo-button" onclick={clear}>Clear selection</button>
    {/snippet}
  </DataGrid>
  <p class="demo-note" aria-live="polite">{lastAction}</p>
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
  .demo-check {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .demo-check select,
  .demo-button {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, ButtonFace);
    color: var(--tx-surface-foreground, ButtonText);
    font: inherit;
  }
  .demo :global(tr.is-overdue > td:nth-child(4)) {
    font-weight: 600;
    text-decoration: underline dotted;
  }
</style>
