<script lang="ts">
import { type ChartFormatters, type PlotSeries, tableRows, tableWindow } from './model.ts';
import './interaction.css';

let {
  series,
  formatters,
  caption = 'Chart data',
}: {
  series: readonly PlotSeries[];
  formatters: ChartFormatters;
  caption?: string;
} = $props();

const rows = $derived(tableRows(series));
let scrollTop = $state(0);
let viewportHeight = $state(320);
const window = $derived(tableWindow(rows.length, scrollTop, viewportHeight));
const visibleRows = $derived(rows.slice(window.start, window.end));

function updateWindow(event: Event) {
  const viewport = event.currentTarget;
  if (!(viewport instanceof HTMLElement)) return;
  scrollTop = viewport.scrollTop;
  viewportHeight = viewport.clientHeight || 320;
}
</script>

<div class="tx-chart-table-viewport" onscroll={updateWindow}>
  <table
    class="tx-chart-table"
    data-chart-table=""
    data-row-count={rows.length}
    aria-rowcount={rows.length + 1}
  >
    <caption>{caption}</caption>
    <thead>
      <tr aria-rowindex="1">
        <th scope="col">Category</th>
        {#each series as s (s.id)}
          <th scope="col">{s.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if window.top > 0}
        <tr aria-hidden="true" class="tx-chart-table__spacer">
          <td colspan={series.length + 1} style:height={`${window.top}px`}></td>
        </tr>
      {/if}
      {#each visibleRows as row, i (window.start + i)}
        <tr aria-rowindex={window.start + i + 2}>
          <th scope="row">{formatters.x(row.xValue)}</th>
          {#each row.cells as cell, k (k)}
            <td>{formatters.y(cell, series[k]?.id ?? '')}</td>
          {/each}
        </tr>
      {/each}
      {#if window.bottom > 0}
        <tr aria-hidden="true" class="tx-chart-table__spacer">
          <td colspan={series.length + 1} style:height={`${window.bottom}px`}></td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>
