<script lang="ts">
import { Stat } from 'texuli/stat';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from 'texuli/table';
import ChartBlockView from './ChartBlockView.svelte';
import { checkDataBlock } from './check.ts';
import type { DataBlockViewProps } from './family.ts';
import { resolveDataBlockLabels } from './labels.ts';

let { block, labels, oninvalid, mode = 'light' }: DataBlockViewProps = $props();

const check = $derived(checkDataBlock(block));
const text = $derived(resolveDataBlockLabels(labels));

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});

function cellText(value: string | number | null): string {
  if (typeof value !== 'number') return value ?? '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  {@const b = check.block}
  {#if b.type === 'table'}
    <div class="tx-block tx-block-table" data-tx-block="table" data-tone={b.tone}>
      <Table
        label={b.caption ? undefined : text.tableSummary}
        aria-label={b.caption ? undefined : text.tableSummary}
      >
        {#if b.caption}
          <TableCaption>{b.caption}</TableCaption>
        {/if}
        <TableHeader>
          <TableRow>
            {#each b.columns as column (column.id)}
              <TableHead>{column.label}</TableHead>
            {/each}
          </TableRow>
        </TableHeader>
        <TableBody>
          {#if b.rows.length === 0}
            <TableEmpty colspan={b.columns.length}>{text.emptyTable}</TableEmpty>
          {:else}
            {#each b.rows as row, ri (ri)}
              <TableRow>
                {#each b.columns as column (column.id)}
                  <TableCell>{cellText(row[column.id] ?? null)}</TableCell>
                {/each}
              </TableRow>
            {/each}
          {/if}
        </TableBody>
      </Table>
    </div>
  {:else if b.type === 'stat' || b.type === 'kpi'}
    <div
      class="tx-block"
      class:tx-block-stat={b.type === 'stat'}
      class:tx-block-kpi={b.type === 'kpi'}
      data-tx-block={b.type}
      data-tone={b.tone}
      role="group"
      aria-label={b.type === 'kpi' ? text.kpiGroup : text.statGroup}
    >
      <div class="tx-stat-grid">
        {#each b.items as item, i (i)}
          <Stat
            label={item.label}
            value={item.value}
            hint={item.hint}
            delta={item.delta}
            data-tone={item.tone}
          />
        {/each}
      </div>
    </div>
  {:else}
    <div class="tx-block tx-block-chart" data-tx-block="chart" data-tone={b.tone}>
      <ChartBlockView block={b} {mode} />
    </div>
  {/if}
{/if}

<style>
  .tx-block {
    overflow-wrap: anywhere;
  }
  /* Breaking anywhere shrinks chart legends to one character per line. */
  .tx-block-chart {
    overflow-wrap: normal;
  }
  /* Same notice grammar as the text, code, structure and media families. */
  .tx-block-invalid {
    margin: 0;
    padding: 0.5em 0.75em;
    border: 1px dashed currentColor;
    border-radius: 0.375em;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875em;
  }
  .tx-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    gap: 0.75rem;
  }
  .tx-block-table,
  .tx-block-chart {
    max-inline-size: 100%;
    overflow-x: auto;
  }
</style>
