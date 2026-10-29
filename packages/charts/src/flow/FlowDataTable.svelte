<script lang="ts">
import '../table/ruled.css';
import { formatFlowValue } from './model.ts';

type Props = {
  title: string;
  summary: string;
  headers: readonly string[];
  rows: readonly { id: string; cells: readonly (string | number)[] }[];
};

let { title, summary, headers, rows }: Props = $props();
</script>

<details class="tx-chart-ruled">
  <summary>{summary}</summary>
  <div class="tx-chart-ruled__scroll">
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>{#each headers as header}<th scope="col">{header}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>{#each row.cells as cell}<td>{typeof cell === 'number' ? formatFlowValue(cell) : cell}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </div>
</details>

<style>
  th { font-weight: 600; text-align: start; }
</style>
