<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Table with fictional invoices: variant, density, stacking and the sticky
 * header from the panel; rows select on click or Enter.
 */
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'texuli/table';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

const invoices = [
  { id: 'INV-1042', customer: 'Harbor Notes', status: 'Paid', cents: 128_000 },
  { id: 'INV-1043', customer: 'Lumen Atlas', status: 'Pending', cents: 46_550 },
  { id: 'INV-1044', customer: 'Quill & Pine', status: 'Overdue', cents: 9_900 },
  { id: 'INV-1045', customer: 'Northwind Labs', status: 'Paid', cents: 312_075 },
];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

let selected = $state('INV-1043');
</script>

<div class="stage" data-tx-table-stage={componentId}>
  <Table
    label={str('label', 'Orders')}
    variant={pick('variant', ['plain', 'striped', 'grid'] as const, 'striped')}
    density={pick('density', ['compact', 'default', 'comfortable'] as const, 'default')}
    stack={pick('stack', ['never', 'sm', 'md'] as const, 'sm')}
    stickyHeader={bool('stickyHeader', true)}
    busy={bool('busy')}
  >
    <TableCaption>Recent invoices (select a row)</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Invoice</TableHead>
        <TableHead>Customer</TableHead>
        <TableHead>Status</TableHead>
        <TableHead numeric>Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each invoices as invoice (invoice.id)}
        <TableRow selected={invoice.id === selected}>
          <TableHead scope="row">
            <button
              type="button"
              class="pick"
              aria-pressed={invoice.id === selected}
              onclick={() => (selected = invoice.id)}
            >
              {invoice.id}
            </button>
          </TableHead>
          <TableCell>{invoice.customer}</TableCell>
          <TableCell>{invoice.status}</TableCell>
          <TableCell numeric>{money.format(invoice.cents / 100)}</TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
</div>

<style>
  .stage {
    display: grid;
  }
  .pick {
    min-block-size: 1.5rem;
    padding: 0;
    border: 0;
    background: none;
    /* Inherit, so the selected row's colors (also in forced colors) apply. */
    color: inherit;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .pick:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
