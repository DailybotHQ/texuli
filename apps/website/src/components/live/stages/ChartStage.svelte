<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Every chart in the catalog with fictional data. Each family loads its own
 * chart subpath, so a card pays only for the chart it shows.
 */
import type { Component } from 'svelte';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

type AnyChart = Component<Record<string, unknown>>;

const CHART_LOADERS: Record<string, () => Promise<AnyChart>> = {
  'charts-area': async () =>
    (await import('@texuli/charts/cartesian')).AreaChart as unknown as AnyChart,
  'charts-bar': async () =>
    (await import('@texuli/charts/cartesian')).BarChart as unknown as AnyChart,
  'charts-cartesian': async () =>
    (await import('@texuli/charts/cartesian')).CartesianChart as unknown as AnyChart,
  'charts-combo': async () =>
    (await import('@texuli/charts/cartesian')).ComboChart as unknown as AnyChart,
  'charts-line': async () =>
    (await import('@texuli/charts/cartesian')).LineChart as unknown as AnyChart,
  'charts-stacked-bar': async () =>
    (await import('@texuli/charts/cartesian')).StackedBarChart as unknown as AnyChart,
  'charts-bullet': async () =>
    (await import('@texuli/charts/compact')).BulletChart as unknown as AnyChart,
  'charts-gauge': async () => (await import('@texuli/charts/compact')).Gauge as unknown as AnyChart,
  'charts-progress-ring': async () =>
    (await import('@texuli/charts/compact')).ProgressRing as unknown as AnyChart,
  'charts-sparkline': async () =>
    (await import('@texuli/charts/compact')).Sparkline as unknown as AnyChart,
  'charts-canvas-renderer': async () =>
    (await import('@texuli/charts/canvas')).CanvasRenderer as unknown as AnyChart,
  'charts-funnel': async () =>
    (await import('@texuli/charts/flow')).FunnelChart as unknown as AnyChart,
  'charts-network': async () =>
    (await import('@texuli/charts/flow')).NetworkGraph as unknown as AnyChart,
  'charts-sankey': async () =>
    (await import('@texuli/charts/flow')).SankeyChart as unknown as AnyChart,
  'charts-geo-map': async () => (await import('@texuli/charts/geo')).GeoMap as unknown as AnyChart,
  'charts-geo-point-map': async () =>
    (await import('@texuli/charts/geo')).GeoPointMap as unknown as AnyChart,
  'charts-bubble': async () =>
    (await import('@texuli/charts/matrix')).BubbleChart as unknown as AnyChart,
  'charts-heatmap': async () =>
    (await import('@texuli/charts/matrix')).HeatmapChart as unknown as AnyChart,
  'charts-scatter': async () =>
    (await import('@texuli/charts/matrix')).ScatterChart as unknown as AnyChart,
  'charts-donut': async () =>
    (await import('@texuli/charts/part-whole')).DonutChart as unknown as AnyChart,
  'charts-pie': async () =>
    (await import('@texuli/charts/part-whole')).PieChart as unknown as AnyChart,
  'charts-sunburst': async () =>
    (await import('@texuli/charts/part-whole')).SunburstChart as unknown as AnyChart,
  'charts-treemap': async () =>
    (await import('@texuli/charts/part-whole')).TreemapChart as unknown as AnyChart,
};

/** Geo shapes live with the geo family; load them only for geo cards. */
let shapes = $state<{ world: unknown; region: unknown } | null>(null);
let Chart = $state<AnyChart | null>(null);
let failed = $state(false);

$effect(() => {
  const load = CHART_LOADERS[componentId];
  if (!load) return;
  let alive = true;
  Promise.all([
    load(),
    componentId.startsWith('charts-geo')
      ? import('@texuli/charts/geo').then((geo) => ({
          world: geo.WORLD_TILES,
          region: geo.REGION_TILES,
        }))
      : Promise.resolve(null),
  ]).then(
    ([component, geo]) => {
      if (!alive) return;
      shapes = geo;
      Chart = component;
    },
    () => {
      if (alive) failed = true;
    }
  );
  return () => {
    alive = false;
  };
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const SERIES = [
  {
    id: 'new',
    label: 'New accounts',
    points: MONTHS.map((x, i) => ({ x, y: [18, 25, 21, 32, 36, 41][i] as number })),
  },
  {
    id: 'returning',
    label: 'Returning accounts',
    points: MONTHS.map((x, i) => ({ x, y: [9, 12, 14, 17, 15, 22][i] as number })),
  },
];
/** The canvas renderer draws already-projected marks, in CSS pixels. */
function canvasSeries(width: number, height: number) {
  const pad = 16;
  const max = 45;
  const step = (width - pad * 2) / MONTHS.length;
  const barWidth = step / (SERIES.length + 1);
  const toY = (value: number) => height - pad - (value / max) * (height - pad * 2);
  return SERIES.map((s, index) => ({
    id: s.id,
    label: s.label,
    color: index === 0 ? 'var(--tx-chart-1)' : 'var(--tx-chart-2)',
    points: s.points.map((point, i) => {
      const x = pad + step * i + step / 2;
      const y = toY(point.y);
      return {
        x,
        y,
        y0: height - pad,
        bar: {
          x: pad + step * i + barWidth * (index + 0.5),
          y,
          width: barWidth,
          height: height - pad - y,
        },
      };
    }),
  }));
}
const PARTS = [
  { id: 'platform', label: 'Platform', value: 42 },
  { id: 'services', label: 'Services', value: 28 },
  { id: 'support', label: 'Support', value: 18 },
  { id: 'other', label: 'Other', value: 12 },
];
const TREE = {
  id: 'company',
  label: 'Harbor Notes',
  children: [
    {
      id: 'product',
      label: 'Product',
      children: [
        { id: 'platform', label: 'Platform', value: 42 },
        { id: 'support', label: 'Support', value: 18 },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      children: [
        { id: 'setup', label: 'Setup', value: 24 },
        { id: 'training', label: 'Training', value: 16 },
      ],
    },
  ],
};
const PART_LABELS = { table: 'Open data table', category: 'Category', value: 'Value' };
const HEAT = ['Design', 'Build', 'Review'].flatMap((y, row) =>
  ['Mon', 'Tue', 'Wed', 'Thu'].map((x, col) => ({ x, y, value: ((row + 2) * (col + 3)) % 9 }))
);
const POINTS = [
  { id: 's1', label: 'North desk', x: 12, y: 40, r: 4, seriesId: 'on-site' },
  { id: 's2', label: 'East desk', x: 28, y: 22, r: 9, seriesId: 'on-site' },
  { id: 's3', label: 'Remote A', x: 18, y: 55, r: 6, seriesId: 'remote' },
  { id: 's4', label: 'Remote B', x: 35, y: 48, r: 12, seriesId: 'remote' },
];
const POINT_SERIES = [
  { id: 'on-site', label: 'On-site' },
  { id: 'remote', label: 'Remote' },
];
const FLOW_NODES = [
  { id: 'site', label: 'Website' },
  { id: 'referral', label: 'Referral' },
  { id: 'trial', label: 'Trial' },
  { id: 'paid', label: 'Paid' },
];
const FLOW_LINKS = [
  { source: 'site', target: 'trial', value: 760 },
  { source: 'referral', target: 'trial', value: 240 },
  { source: 'trial', target: 'paid', value: 190 },
];
const REGIONS: Record<string, number | null> = {
  'north-america': 68,
  'western-europe': 62,
  'east-asia': 79,
  'south-asia': 56,
  'south-america': 35,
  'southeast-asia': 52,
  oceania: 42,
  'sub-saharan-africa': 18,
  'northern-europe': 46,
  'middle-east': 31,
  'north-africa': null,
};
const DISTRICTS = [
  { id: 'harbor', label: 'Harbor team', regionId: 'harbor-point', value: 31 },
  { id: 'ridge', label: 'Ridge team', regionId: 'north-ridge', value: 25 },
  { id: 'town', label: 'Town team', regionId: 'old-town', value: 39 },
  { id: 'tide', label: 'Tide team', regionId: 'tidewater', value: 21 },
];

const KINDS = ['line', 'area', 'bar', 'stacked-bar', 'combo'] as const;

/** Props per chart: fictional data plus the panel's values. */
const chartProps = $derived.by((): Record<string, unknown> => {
  const title = str('title', 'Account growth');
  const description = str('description', 'New and returning accounts by month (fictional).');
  const label = str('label', 'Weekly signups');
  switch (componentId) {
    case 'charts-area':
    case 'charts-bar':
    case 'charts-line':
    case 'charts-stacked-bar':
    case 'charts-combo':
    case 'charts-cartesian':
      return {
        title,
        description,
        series: SERIES,
        ...(componentId === 'charts-cartesian' ? { kind: pick('kind', KINDS, 'line') } : {}),
        renderer: pick('renderer', ['svg', 'canvas', 'auto'] as const, 'svg'),
      };
    case 'charts-bullet':
      return {
        label: str('label', 'Release progress'),
        value: num('value', 68),
        max: num('max', 100),
        target: num('target', 75),
        ranges: [55, 85],
      };
    case 'charts-gauge':
      return {
        label: str('label', 'Service health'),
        value: num('value', 92),
        min: num('min', 0),
        max: num('max', 100),
        thresholds: [60, 80],
        bandLabels: ['Needs attention', 'Good', 'Excellent'],
      };
    case 'charts-progress-ring':
      return { label: str('label', 'Tasks complete'), value: num('value', 8), max: num('max', 10) };
    case 'charts-sparkline':
      return {
        label,
        values: [18, 21, 19, 25, 27, 23, 31, 34],
        period: str('period', 'eight weeks'),
        variant: pick('variant', ['line', 'area', 'bar'] as const, 'area'),
        showLast: bool('showLast', true),
      };
    case 'charts-canvas-renderer': {
      const width = Math.min(1200, Math.max(120, num('width', 640)));
      const height = Math.min(800, Math.max(80, num('height', 320)));
      return {
        kind: pick('kind', KINDS, 'line'),
        series: canvasSeries(width, height),
        width,
        height,
      };
    }
    case 'charts-funnel':
      return {
        title: str('title', 'Signup conversion'),
        description: str('description', 'From visit to paid account.'),
        orientation: pick('orientation', ['vertical', 'horizontal'] as const, 'vertical'),
        steps: [
          { id: 'visit', label: 'Visits', value: 1200 },
          { id: 'trial', label: 'Trials', value: 760 },
          { id: 'account', label: 'Accounts', value: 420 },
          { id: 'paid', label: 'Paid', value: 190 },
        ],
      };
    case 'charts-sankey':
      return {
        title: str('title', 'Traffic sources'),
        description: str('description', 'Visitors flow through trials to paid accounts.'),
        nodes: FLOW_NODES,
        links: FLOW_LINKS,
      };
    case 'charts-network':
      return {
        title: str('title', 'Team dependencies'),
        description: str('description', 'Which teams rely on which.'),
        nodes: FLOW_NODES.map((n, i) => ({ ...n, value: 4 - i })),
        links: FLOW_LINKS.map((l) => ({ ...l, value: Math.ceil(l.value / 200) })),
      };
    case 'charts-geo-map':
      return {
        title: str('title', 'Orders by region'),
        description: str('description', 'Schematic world tiles, not precise borders.'),
        data: REGIONS,
        shape: shapes?.world,
      };
    case 'charts-geo-point-map':
      return {
        title: str('title', 'Team activity'),
        description: str('description', 'Marker size shows activity by district.'),
        points: DISTRICTS,
        shape: shapes?.region,
      };
    case 'charts-heatmap':
      return {
        title: str('title', 'Weekly volume'),
        description: str('description', 'Story points by squad and day.'),
        cells: HEAT,
      };
    case 'charts-scatter':
    case 'charts-bubble':
      return {
        title: str('title', 'Usage and reach'),
        description: str('description', 'Usage compared with reach.'),
        points: POINTS,
        series: POINT_SERIES,
      };
    case 'charts-pie':
    case 'charts-donut':
      return {
        title: str('title', 'Tickets by status'),
        description: str('description', 'Ticket distribution.'),
        data: PARTS,
        labels: PART_LABELS,
      };
    default:
      return {
        title: str('title', 'Revenue structure'),
        description: str('description', 'Revenue by product group.'),
        root: TREE,
        labels: PART_LABELS,
      };
  }
});
</script>

<div class="chart" data-tx-chart-stage={componentId}>
  {#if failed}
    <p role="alert">The chart failed to load.</p>
  {:else if Chart && componentId === 'charts-canvas-renderer'}
    <div
      class="canvas"
      role="img"
      aria-label="New and returning accounts drawn on a canvas layer"
      style:aspect-ratio={`${chartProps.width} / ${chartProps.height}`}
    >
      <Chart {...chartProps} />
    </div>
  {:else if Chart}
    <Chart {...chartProps} />
  {:else}
    <p class="loading" role="status">Loading chart…</p>
  {/if}
</div>

<style>
  .chart {
    display: grid;
    inline-size: 100%;
  }
  .canvas {
    position: relative;
    inline-size: 100%;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
  }
  .loading {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
