<script lang="ts">
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from 'texuli/table';

interface Invoice {
  id: string;
  customer: string;
  status: string;
  amountCents: number;
}

// Fictional data only.
const invoices: Invoice[] = [
  { id: 'INV-1042', customer: 'Harbor Notes', status: 'Paid', amountCents: 128_000 },
  { id: 'INV-1043', customer: 'Lumen Atlas', status: 'Pending', amountCents: 46_550 },
  { id: 'INV-1044', customer: 'Quill & Pine', status: 'Overdue', amountCents: 9_900 },
  { id: 'INV-1045', customer: 'Northwind Labs', status: 'Paid', amountCents: 312_075 },
];

const ships = Array.from({ length: 12 }, (_, index) => ({
  id: `SH-${200 + index}`,
  port: ['Lisbon', 'Valparaíso', 'Osaka', 'Mombasa'][index % 4] as string,
  eta: `Day ${index + 2}`,
  crates: 40 + ((index * 37) % 90),
}));

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const total = invoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);
</script>

<section data-example="texuli-table" aria-labelledby="table-demo-title">
  <h2 id="table-demo-title">Table</h2>

  <h3>Plain, with a footer</h3>
  <Table>
    <TableCaption>Recent invoices</TableCaption>
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
        <TableRow selected={invoice.id === 'INV-1043'}>
          <TableHead scope="row">{invoice.id}</TableHead>
          <TableCell>{invoice.customer}</TableCell>
          <TableCell>
            {invoice.status}{#if invoice.id === 'INV-1043'}&nbsp;(selected){/if}
          </TableCell>
          <TableCell numeric>{money.format(invoice.amountCents / 100)}</TableCell>
        </TableRow>
      {/each}
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableHead scope="row" colspan={3}>Total</TableHead>
        <TableCell numeric>{money.format(total / 100)}</TableCell>
      </TableRow>
    </TableFooter>
  </Table>

  <h3>Striped, compact</h3>
  <Table variant="striped" density="compact">
    <TableCaption hidden>Invoices, compact</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Invoice</TableHead>
        <TableHead>Customer</TableHead>
        <TableHead numeric>Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each invoices as invoice (invoice.id)}
        <TableRow>
          <TableCell>{invoice.id}</TableCell>
          <TableCell>{invoice.customer}</TableCell>
          <TableCell numeric>{money.format(invoice.amountCents / 100)}</TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>

  <h3>Grid, comfortable, empty</h3>
  <Table variant="grid" density="comfortable">
    <TableCaption>Disputes</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Case</TableHead>
        <TableHead>Opened</TableHead>
        <TableHead align="center">Priority</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableEmpty colspan={3}>No open disputes.</TableEmpty>
    </TableBody>
  </Table>

  <h3>Sticky header in a capped area</h3>
  <Table stickyHeader maxBlockSize="12rem" label="Shipments, scrollable" busy={false}>
    <TableCaption hidden>Shipments</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Shipment</TableHead>
        <TableHead>Port</TableHead>
        <TableHead>ETA</TableHead>
        <TableHead numeric>Crates</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each ships as ship (ship.id)}
        <TableRow>
          <TableCell>{ship.id}</TableCell>
          <TableCell>{ship.port}</TableCell>
          <TableCell>{ship.eta}</TableCell>
          <TableCell numeric>{ship.crates}</TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>

  <h3>Stacked rows in a narrow panel</h3>
  <div class="table-demo-narrow">
    <Table stack="sm">
      <TableCaption>Invoices, stacked</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead numeric>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each invoices.slice(0, 2) as invoice (invoice.id)}
          <TableRow>
            <TableCell>{invoice.id}</TableCell>
            <TableCell>{invoice.customer}</TableCell>
            <TableCell numeric>{money.format(invoice.amountCents / 100)}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>

  <h3>Right to left</h3>
  <div dir="rtl" lang="ar">
    <Table variant="striped">
      <TableCaption>الفواتير</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>الفاتورة</TableHead>
          <TableHead>العميل</TableHead>
          <TableHead numeric>المبلغ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each invoices.slice(0, 3) as invoice (invoice.id)}
          <TableRow selected={invoice.id === 'INV-1042'}>
            <TableCell>{invoice.id}</TableCell>
            <TableCell>{invoice.customer}</TableCell>
            <TableCell numeric>{money.format(invoice.amountCents / 100)}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>
</section>

<style>
  .table-demo-narrow {
    max-inline-size: 22rem;
  }
</style>
