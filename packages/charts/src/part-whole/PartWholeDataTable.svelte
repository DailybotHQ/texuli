<script lang="ts">
import '../table/ruled.css';
import '../table/depth.css';
import {
  formatPartWholeValue,
  type PartWholeTableLabels,
  type PartWholeTableRow,
} from './model.ts';

type Props = {
  title: string;
  labels: PartWholeTableLabels;
  rows: readonly PartWholeTableRow[];
};

let { title, labels, rows }: Props = $props();
</script>

<details class="tx-chart-ruled table-fallback">
  <summary>{labels.table}</summary>
  <div class="tx-chart-ruled__scroll">
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">{labels.category}</th>
          <th scope="col">{labels.value}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr>
            <th scope="row" data-depth={Math.min(row.depth ?? 0, 6)}>{row.label}</th>
            <td>{formatPartWholeValue(row.value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</details>

<style>
  /* The part-whole disclosure keeps its compact summary. */
  .table-fallback summary { min-block-size: auto; }
</style>
