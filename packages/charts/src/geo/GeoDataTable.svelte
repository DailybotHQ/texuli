<script lang="ts">
import '../table/ruled.css';
import { formatGeoValue, type GeoTableLabels } from './model.ts';

type Row = { id: string; label: string; location?: string; value: number | null };
type Props = { title: string; labels: GeoTableLabels; rows: readonly Row[]; pointRows?: boolean };

let { title, labels, rows, pointRows = false }: Props = $props();
</script>

<details class="tx-chart-ruled">
  <summary>{labels.table}</summary>
  <div class="tx-chart-ruled__scroll">
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
