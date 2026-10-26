<script lang="ts">
import { formatFlowValue } from './model.ts';

type Props = {
  title: string;
  summary: string;
  headers: readonly string[];
  rows: readonly { id: string; cells: readonly (string | number)[] }[];
};

let { title, summary, headers, rows }: Props = $props();
</script>

<details class="flow-table">
  <summary>{summary}</summary>
  <div class="table-scroll">
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
  .flow-table { color: var(--tx-foreground, CanvasText); font: inherit; font-size: 0.875rem; }
  .flow-table summary { align-content: center; cursor: pointer; inline-size: fit-content; min-block-size: 2.75rem; padding-block: 0.5rem; text-decoration: underline; text-underline-offset: 0.2em; }
  .table-scroll { max-inline-size: 100%; overflow-x: auto; }
  table { border-collapse: collapse; inline-size: 100%; text-align: start; }
  caption { padding-block: 0.5rem; text-align: start; }
  th, td { border-block-end: 1px solid var(--tx-border, currentColor); padding-block: 0.35rem; padding-inline: 0.5rem; }
  th { font-weight: 600; text-align: start; }
  @media (forced-colors: active) { .flow-table summary:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; } }
</style>
