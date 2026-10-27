<script lang="ts">
import { formatGeoValue, type GeoTableLabels } from './model.ts';

type Row = { id: string; label: string; location?: string; value: number | null };
type Props = { title: string; labels: GeoTableLabels; rows: readonly Row[]; pointRows?: boolean };

let { title, labels, rows, pointRows = false }: Props = $props();
</script>

<details class="geo-table">
  <summary>{labels.table}</summary>
  <div class="table-scroll">
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">{pointRows ? labels.point : labels.region}</th>
          {#if pointRows}<th scope="col">{labels.location}</th>{/if}
          <th scope="col">{labels.value}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            <th scope="row">{row.label}</th>
            {#if pointRows}<td>{row.location ?? labels.noData}</td>{/if}
            <td>{formatGeoValue(row.value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</details>

<style>
  .geo-table { color: var(--tx-foreground, CanvasText); font: inherit; font-size: 0.875rem; }
  summary { align-content: center; cursor: pointer; inline-size: fit-content; min-block-size: 2.75rem; padding-block: 0.5rem; text-decoration: underline; text-underline-offset: 0.2em; }
  .table-scroll { max-inline-size: 100%; overflow-x: auto; }
  table { border-collapse: collapse; inline-size: 100%; text-align: start; }
  caption { padding-block: 0.5rem; text-align: start; }
  th, td { border-block-end: 1px solid var(--tx-border, currentColor); padding-block: 0.35rem; padding-inline: 0.5rem; }
  th[scope='row'] { font-weight: 500; text-align: start; }
  @media (forced-colors: active) { summary:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; } }
</style>
