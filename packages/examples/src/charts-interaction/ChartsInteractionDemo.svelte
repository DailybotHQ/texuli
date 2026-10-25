<script lang="ts">
import {
  type ChartFormatters,
  ChartTable,
  InteractivePlot,
  Legend,
  type PlotSeries,
  TableToggle,
} from '@texuli/charts/interaction';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const series: PlotSeries[] = [
  {
    id: 'signups',
    label: 'Signups',
    color: 'var(--tx-chart-1, #3b82f6)',
    points: [12, 18, 15, 22, 28].map((v, i) => ({
      x: 60 + i * 80,
      y: 200 - v * 4,
      xValue: i,
      yValue: v,
    })),
  },
  {
    id: 'trials',
    label: 'Trials',
    color: 'var(--tx-chart-2, #22c55e)',
    points: [6, 9, 11, 14, 17].map((v, i) => ({
      x: 60 + i * 80,
      y: 200 - v * 5,
      xValue: i,
      yValue: v,
    })),
  },
];

const formatters: ChartFormatters = {
  x: (v) => DAYS[Number(v)] ?? String(v),
  y: (v) => (v === null ? '—' : `${v}`),
};

const plot = { x: 40, y: 16, width: 400, height: 180 };
const width = 480;
const height = 240;

let hidden = $state(new Set<string>());
let tableOpen = $state(false);
let selected = $state<string>('None yet');
let domainNote = $state('Full range');

const visible = $derived(series.filter((s) => !hidden.has(s.id)));
</script>

<article
  class="demo"
  data-example="charts-interaction"
  data-tx-motion="reduce"
  aria-labelledby="charts-interaction-title"
>
  <h2 id="charts-interaction-title">Chart interaction</h2>
  <p class="lede">
    Keyboard and pointer exploration with live announcements, tooltips, legend toggles, and a data
    table. Fictional Harbor Notes metrics.
  </p>

  <Legend
    items={series.map((s) => ({ id: s.id, label: s.label, color: s.color }))}
    {hidden}
    onchange={(next) => (hidden = next)}
  />

  <InteractivePlot
    label="Signups and trials"
    series={visible}
    {hidden}
    {width}
    {height}
    {plot}
    {formatters}
    onselect={(sel) => {
      selected = `${sel.series.label} at ${formatters.x(sel.series.points[sel.index]?.xValue ?? '')}`;
    }}
    brushInvert={(px) => px}
    fullDomain={[0, 480]}
    onbrush={(domain) => {
      domainNote = `Brush ${domain[0].toFixed(0)}–${domain[1].toFixed(0)}`;
    }}
    onzoom={(domain) => {
      domainNote = `Zoom ${domain[0].toFixed(0)}–${domain[1].toFixed(0)}`;
    }}
  >
    {#snippet children()}
      <g aria-hidden="true">
        {#each visible as s (s.id)}
          <polyline
            fill="none"
            stroke={s.color}
            stroke-width="2"
            points={s.points
              .filter((p) => p.y !== null)
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
          />
        {/each}
      </g>
    {/snippet}
  </InteractivePlot>

  <p data-chart-selection="">Selection: {selected}</p>
  <p data-chart-domain="">{domainNote}</p>

  <TableToggle bind:open={tableOpen} />
  {#if tableOpen}
    <ChartTable {series} {formatters} caption="Harbor Notes weekly signups" />
  {/if}
</article>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    max-inline-size: 36rem;
    padding: 1.25rem;
  }
  .lede {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.9375rem;
  }
</style>
