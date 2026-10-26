<script lang="ts">
import type { Component } from 'svelte';
import type { ChartBlock, ChartKind } from '../core/index.ts';
import { isExtendedChartKind } from './chart-kinds.ts';

let { block, mode = 'light' }: { block: ChartBlock; mode?: 'light' | 'dark' } = $props();

type ChartModule = Record<string, unknown>;

const families = {
  cartesian: () => import('@texuli/charts/cartesian'),
  matrix: () => import('@texuli/charts/matrix'),
  partWhole: () => import('@texuli/charts/part-whole'),
  compact: () => import('@texuli/charts/compact'),
  flow: () => import('@texuli/charts/flow'),
  geo: () => import('@texuli/charts/geo'),
  histogram: () => import('@texuli/charts/histogram'),
  pack: () => import('@texuli/charts/pack'),
  calendar: () => import('@texuli/charts/calendar'),
} satisfies Record<string, () => Promise<ChartModule>>;

/** Kind → lazy family subpath and component export (one chart id each). */
const components: Record<ChartKind, [keyof typeof families, string]> = {
  line: ['cartesian', 'LineChart'],
  area: ['cartesian', 'AreaChart'],
  bar: ['cartesian', 'BarChart'],
  'stacked-bar': ['cartesian', 'StackedBarChart'],
  combo: ['cartesian', 'ComboChart'],
  heatmap: ['matrix', 'HeatmapChart'],
  scatter: ['matrix', 'ScatterChart'],
  bubble: ['matrix', 'BubbleChart'],
  pie: ['partWhole', 'PieChart'],
  donut: ['partWhole', 'DonutChart'],
  sunburst: ['partWhole', 'SunburstChart'],
  treemap: ['partWhole', 'TreemapChart'],
  sparkline: ['compact', 'Sparkline'],
  bullet: ['compact', 'BulletChart'],
  gauge: ['compact', 'Gauge'],
  'progress-ring': ['compact', 'ProgressRing'],
  funnel: ['flow', 'FunnelChart'],
  sankey: ['flow', 'SankeyChart'],
  network: ['flow', 'NetworkGraph'],
  'geo-map': ['geo', 'GeoMap'],
  'geo-point-map': ['geo', 'GeoPointMap'],
  histogram: ['histogram', 'HistogramChart'],
  pack: ['pack', 'PackChart'],
  calendar: ['calendar', 'CalendarHeatmap'],
};

const PART_WHOLE_LABELS = { table: 'View data table', category: 'Category', value: 'Value' };
/** The charts palette fallbacks for `--tx-chart-1` … `--tx-chart-8`. */
const FALLBACKS = 'primary success info warning destructive secondary accent link'.split(' ');

/**
 * Blocks accept only bare `var(--token)` colors. Give each one the fallback
 * chain the charts use for their own defaults, so a theme without chart
 * tokens never resolves the color to black.
 */
const themed = (color: string) =>
  color.replace(
    /^var\((--tx-chart-([1-8])|.+)\)$/,
    (_, name, slot) =>
      `var(${name}, ${slot ? `var(--tx-${FALLBACKS[slot - 1]}, CanvasText)` : 'currentColor'})`
  );

/** Apply {@link themed} to every `color` in an array prop (series, points, annotations). */
const recolor = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => (item?.color ? { ...item, color: themed(item.color) } : item))
    : value;

let Chart = $state<Component<Record<string, unknown>> | null>(null);
let loadError = $state('');

/** Props for the chart component: block text plus validated data, never raw input. */
const chartProps = $derived.by((): Record<string, unknown> => {
  const kind = block.kind;
  const family = components[kind][0];
  const props: Record<string, unknown> = {
    ...block.props,
    [family === 'compact' ? 'label' : 'title']: block.title,
    description: block.description,
  };
  if (family === 'partWhole') {
    props.labels = { ...PART_WHOLE_LABELS, ...(block.props?.labels as object | undefined) };
  }
  if (!isExtendedChartKind(kind)) {
    // Inline kinds: top-level data (scatter keeps its `props.series` labels).
    Object.assign(props, {
      mode,
      cells: block.cells,
      points: block.points,
      series: block.series ?? props.series,
    });
  }
  for (const key in props) props[key] = recolor(props[key]);
  return props;
});

$effect(() => {
  let cancelled = false;
  loadError = '';
  Chart = null;
  const [family, name] = components[block.kind];
  (async () => {
    try {
      const mod = await families[family]();
      if (!cancelled) Chart = mod[name as keyof typeof mod] as Component<Record<string, unknown>>;
    } catch (error) {
      if (!cancelled) {
        loadError = error instanceof Error ? error.message : 'Chart failed to load';
      }
    }
  })();
  return () => {
    cancelled = true;
  };
});
</script>

{#if components[block.kind][0] === 'compact'}
  <!-- Compact charts use their label only as an accessible name. -->
  <h3 class="tx-block-chart-title">{block.title}</h3>
  <p class="tx-block-chart-description">{block.description}</p>
{/if}
{#if loadError}
  <p class="tx-block-chart-error" role="note">{loadError}</p>
{:else if Chart}
  <Chart {...chartProps} />
{:else}
  <p class="tx-block-chart-loading" role="status">Loading chart…</p>
{/if}

<style>
  .tx-block-chart-title {
    margin: 0;
    font-size: var(--tx-font-size-base, 1rem);
  }
  .tx-block-chart-description {
    margin-block: 0.25rem 0.75rem;
    color: var(--tx-muted-foreground, CanvasText);
    white-space: pre-line;
  }
  .tx-block-chart-loading,
  .tx-block-chart-error {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: var(--tx-font-size-sm, 0.875rem);
  }
</style>
