<script lang="ts">
import type { ComponentProps } from 'svelte';
import Table from '../../src/components/table/Table.svelte';
import TableBody from '../../src/components/table/TableBody.svelte';
import TableCaption from '../../src/components/table/TableCaption.svelte';
import TableCell from '../../src/components/table/TableCell.svelte';
import TableFooter from '../../src/components/table/TableFooter.svelte';
import TableHead from '../../src/components/table/TableHead.svelte';
import TableHeader from '../../src/components/table/TableHeader.svelte';
import TableRow from '../../src/components/table/TableRow.svelte';

type Props = Omit<ComponentProps<typeof Table>, 'children'> & {
  /** Appends a third body row, to test relabelling after a change. */
  extraRow?: boolean;
};

let { extraRow = false, ...tableProps }: Props = $props();
</script>

<Table {...tableProps}>
  <TableCaption>Invoices</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Customer</TableHead>
      <TableHead numeric>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV-1</TableCell>
      <TableCell>Harbor Notes</TableCell>
      <TableCell numeric>$12.00</TableCell>
    </TableRow>
    <TableRow selected>
      <TableCell>INV-2</TableCell>
      <TableCell>Lumen Atlas</TableCell>
      <TableCell label="Due on">Monday</TableCell>
    </TableRow>
    {#if extraRow}
      <TableRow>
        <TableCell>INV-3</TableCell>
        <TableCell>Quill and Pine</TableCell>
        <TableCell numeric>$3.00</TableCell>
      </TableRow>
    {/if}
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableHead scope="row" colspan={2}>Total</TableHead>
      <TableCell numeric>$15.00</TableCell>
    </TableRow>
  </TableFooter>
</Table>
