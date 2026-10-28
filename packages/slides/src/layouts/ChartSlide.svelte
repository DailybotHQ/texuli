<script lang="ts">
/**
 * `chart`: one chart block (any Texuli chart kind) through the `blocks-data`
 * family, sized by `height`. The chart family carries its own accessible
 * summary; `showTable` adds a plain data table under it for series charts
 * (point `x` by series). A spec the chart block parser refuses shows a note
 * instead of a broken chart.
 */
import BlockRenderer from '../stage/BlockRenderer.svelte';
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { layoutChartBlock } from './media.ts';
import { layoutMessage } from './messages.ts';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'chart'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let block = $derived(layoutChartBlock(p.spec));

interface TableData {
  title: string;
  series: string[];
  rows: { x: string; values: string[] }[];
}

/** A series chart as a table (x by series); `null` for other chart shapes. */
let table = $derived.by((): TableData | null => {
  if (!p.showTable || !block || block.type !== 'chart' || !('series' in block)) return null;
  const series = (block.series ?? []) as {
    label?: string;
    points?: { x?: unknown; y?: unknown }[];
  }[];
  const xs: string[] = [];
  for (const item of series) {
    for (const point of item.points ?? []) {
      const x = String(point.x ?? '');
      if (!xs.includes(x)) xs.push(x);
    }
  }
  if (xs.length === 0 || xs.length > 24) return null;
  return {
    title: block.title,
    series: series.map((item, index) => item.label ?? String(index + 1)),
    rows: xs.map((x) => ({
      x,
      values: series.map((item) => {
        const y = item.points?.find((point) => String(point.x ?? '') === x)?.y;
        return typeof y === 'number' ? y.toLocaleString(context.deck.meta.locale) : '—';
      }),
    })),
  };
});
</script>

<LayoutFrame layout="chart" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <div class="chart" data-slot="chart" data-height={p.height ?? 'md'} data-table={table ? 'true' : undefined}>
    <div class="plot" {...steps.at(['spec'])}>
      {#if block}
        <BlockRenderer {block} mediaTrust={context.tier} t={context.t} />
      {:else}
        <p class="tx-deck-layout__refused" role="note">{layoutMessage('layout.chartInvalid')}</p>
      {/if}
    </div>
    {#if table}
      <table class="data">
        <caption class="tx-deck-layout__caption">
          {layoutMessage('layout.chartTable', { title: table.title })}
        </caption>
        <thead>
          <tr>
            <td></td>
            {#each table.series as name, index (index)}
              <th scope="col">{name}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each table.rows as row (row.x)}
            <tr>
              <th scope="row">{row.x}</th>
              {#each row.values as value, index (index)}
                <td>{value}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</LayoutFrame>

<style>
  .chart {
    display: grid;
    flex: 1;
    grid-template-rows: minmax(0, 1fr);
    align-content: center;
    gap: clamp(12px, 1.6cqi, 24px);
    min-block-size: 0;
  }

  .chart[data-table="true"] {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: center;
  }

  .plot {
    min-inline-size: 0;
    min-block-size: 0;
    max-block-size: 100%;
  }

  .chart[data-height="sm"] .plot {
    max-block-size: 60%;
  }

  .chart[data-height="lg"] .plot {
    max-block-size: none;
  }

  .data {
    border-collapse: collapse;
    font-size: var(--tx-deck-type-label);
    font-variant-numeric: tabular-nums;
  }

  .data caption {
    margin-block-end: 8px;
    text-align: start;
    font-weight: 600;
  }

  .data th,
  .data td {
    padding-block: 6px;
    padding-inline: 10px;
    border-block-end: 1px solid var(--tx-deck-panel-border);
    text-align: end;
  }

  .data th[scope="row"] {
    text-align: start;
  }

  @container (max-inline-size: 48rem) {
    .chart[data-table="true"] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
