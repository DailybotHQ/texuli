<script lang="ts">
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

<details class="table-fallback">
  <summary>{labels.table}</summary>
  <div class="table-scroll">
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
  .table-fallback {
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-size: 0.875rem;
  }

  .table-fallback summary {
    cursor: pointer;
    inline-size: fit-content;
    padding-block: 0.5rem;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .table-scroll {
    max-inline-size: 100%;
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    inline-size: 100%;
    text-align: start;
  }

  caption {
    padding-block: 0.5rem;
    text-align: start;
  }

  th,
  td {
    border-block-end: 1px solid var(--tx-border, currentColor);
    padding-block: 0.35rem;
    padding-inline: 0.5rem;
  }

  th[scope='row'] {
    font-weight: 500;
    text-align: start;
  }

  th[scope='row'][data-depth='1'] {
    padding-inline-start: 1.5rem;
  }

  th[scope='row'][data-depth='2'] {
    padding-inline-start: 2.5rem;
  }

  th[scope='row'][data-depth='3'] {
    padding-inline-start: 3.5rem;
  }

  th[scope='row'][data-depth='4'] {
    padding-inline-start: 4.5rem;
  }

  th[scope='row'][data-depth='5'] {
    padding-inline-start: 5.5rem;
  }

  th[scope='row'][data-depth='6'] {
    padding-inline-start: 6.5rem;
  }

  @media (forced-colors: active) {
    .table-fallback summary:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
