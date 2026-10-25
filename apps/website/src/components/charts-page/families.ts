/**
 * Charts gallery catalog: every @texuli/charts family with data contracts.
 * Static data only — no network.
 */

export type ChartFamilyId =
  | 'cartesian'
  | 'part-whole'
  | 'compact'
  | 'matrix'
  | 'flow'
  | 'geo'
  | 'interaction'
  | 'canvas';

export type ChartContractField = {
  name: string;
  type: string;
  required?: boolean;
  notes?: string;
};

export type ChartFamily = {
  id: ChartFamilyId;
  title: string;
  summary: string;
  /** Public import path. */
  importPath: string;
  /** Primary component exports shown in the gallery. */
  components: readonly string[];
  /** Data contract fields agents and hosts must supply. */
  contract: readonly ChartContractField[];
  /** Fictional Harbor metrics description. */
  sampleNote: string;
};

export const CHART_FAMILIES: readonly ChartFamily[] = Object.freeze([
  {
    id: 'cartesian',
    title: 'Cartesian',
    summary: 'Line, area, bar, stacked bar and combo charts on a shared series model.',
    importPath: '@texuli/charts/cartesian',
    components: ['LineChart', 'AreaChart', 'BarChart', 'StackedBarChart', 'ComboChart'],
    contract: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true, notes: 'Accessible long description' },
      {
        name: 'series',
        type: 'CartesianSeries[]',
        required: true,
        notes: '{ id, label, points: { x, y }[] }',
      },
      { name: 'mode', type: "'light' | 'dark'", notes: 'Optional palette override' },
      { name: 'renderer', type: "'auto' | 'svg' | 'canvas'", notes: 'Dense series may use canvas' },
      { name: 'interactive', type: 'boolean', notes: 'Enables brush/zoom/select hooks' },
    ],
    sampleNote: 'Monthly new and returning Harbor Notes accounts (fictional counts).',
  },
  {
    id: 'part-whole',
    title: 'Part-whole',
    summary: 'Pie, donut, treemap and sunburst for categorical and hierarchical shares.',
    importPath: '@texuli/charts/part-whole',
    components: ['PieChart', 'DonutChart', 'TreemapChart', 'SunburstChart'],
    contract: [
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
      {
        name: 'data',
        type: 'PartWholeDatum[]',
        notes: 'Flat slices: { id, label, value } — pie and donut',
      },
      {
        name: 'root',
        type: 'PartWholeTree',
        notes: 'Hierarchy: { id, label, value? | children[] } — treemap and sunburst',
      },
      { name: 'labels', type: 'PartWholeTableLabels', notes: 'Table chrome copy' },
    ],
    sampleNote: 'Quarterly revenue mix in millions (fictional Example Co.).',
  },
  {
    id: 'compact',
    title: 'Compact',
    summary: 'Sparklines, bullets, gauges and progress rings for dense dashboards.',
    importPath: '@texuli/charts/compact',
    components: ['Sparkline', 'BulletChart', 'Gauge', 'ProgressRing'],
    contract: [
      { name: 'label', type: 'string', required: true },
      { name: 'values', type: 'readonly number[]', notes: 'Sparkline sequence' },
      { name: 'value', type: 'number', notes: 'Bullet, gauge, ring current value' },
      { name: 'max', type: 'number', notes: 'Bullet and ring scale' },
      { name: 'target', type: 'number', notes: 'Bullet target marker' },
      { name: 'ranges', type: 'number[]', notes: 'Bullet qualitative bands' },
      { name: 'thresholds', type: 'number[]', notes: 'Gauge band edges' },
    ],
    sampleNote: 'Weekly signups, quarterly revenue target and service health (fictional).',
  },
  {
    id: 'matrix',
    title: 'Matrix',
    summary: 'Heatmap, scatter and bubble plots for two- and three-dimensional metrics.',
    importPath: '@texuli/charts/matrix',
    components: ['HeatmapChart', 'ScatterChart', 'BubbleChart'],
    contract: [
      {
        name: 'cells',
        type: 'HeatmapCell[]',
        notes: '{ x, y, value } categorical axes',
      },
      {
        name: 'points',
        type: 'ScatterPoint[]',
        notes: '{ id, label, x, y, r?, seriesId? }',
      },
      { name: 'series', type: '{ id, label }[]', notes: 'Legend groups for scatter/bubble' },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
    ],
    sampleNote: 'Squad effort by weekday; latency vs throughput; service footprint (fictional).',
  },
  {
    id: 'flow',
    title: 'Flow',
    summary: 'Funnel, sankey and network graphs for conversion and collaboration flows.',
    importPath: '@texuli/charts/flow',
    components: ['FunnelChart', 'SankeyChart', 'NetworkGraph'],
    contract: [
      {
        name: 'steps',
        type: '{ id, label, value }[]',
        notes: 'Funnel ordered stages',
      },
      {
        name: 'nodes',
        type: '{ id, label, value? }[]',
        notes: 'Sankey / network nodes',
      },
      {
        name: 'links',
        type: '{ source, target, value }[]',
        notes: 'Directed edges between node ids',
      },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
    ],
    sampleNote: 'Signup funnel and acquisition flow for Harbor Notes (illustrative).',
  },
  {
    id: 'geo',
    title: 'Geo',
    summary: 'Offline choropleth and point maps on bundled schematic tiles (not live GIS).',
    importPath: '@texuli/charts/geo',
    components: ['GeoMap', 'GeoPointMap'],
    contract: [
      {
        name: 'data',
        type: 'Record<string, number | null>',
        notes: 'Region id → value; null uses patterned missing fill',
      },
      {
        name: 'points',
        type: 'GeoPointDatum[]',
        notes: '{ id, label, regionId, value, offset? }',
      },
      { name: 'shape', type: 'GeoShape', notes: 'WORLD_TILES or REGION_TILES' },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
    ],
    sampleNote: 'Revenue by world region and team activity on Harbor Bay districts (schematic).',
  },
  {
    id: 'interaction',
    title: 'Interaction',
    summary: 'Legend toggles, keyboard plot focus, tooltips, brush/zoom and data table.',
    importPath: '@texuli/charts/interaction',
    components: ['InteractivePlot', 'Legend', 'ChartTable', 'TableToggle'],
    contract: [
      {
        name: 'series',
        type: 'PlotSeries[]',
        required: true,
        notes: '{ id, label, color, points: { x, y, xValue, yValue }[] }',
      },
      { name: 'formatters', type: 'ChartFormatters', notes: 'x/y label formatters' },
      { name: 'hidden', type: 'ReadonlySet<string>', notes: 'Legend-hidden series ids' },
      { name: 'onselect / onbrush / onzoom', type: 'callbacks', notes: 'Optional host hooks' },
    ],
    sampleNote: 'Weekly signups and trials with live selection announcements (fictional).',
  },
  {
    id: 'canvas',
    title: 'Canvas renderer',
    summary: 'Dense cartesian series rendered on canvas with the same contracts as SVG charts.',
    importPath: '@texuli/charts/cartesian',
    components: ['LineChart', 'AreaChart'],
    contract: [
      { name: 'series', type: 'CartesianSeries[]', required: true },
      {
        name: 'renderer',
        type: "'canvas' | 'auto'",
        required: true,
        notes: 'Force canvas for dense samples',
      },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
    ],
    sampleNote: 'Deterministic daily activity curve (512 samples) on canvas.',
  },
]);

export function familyById(id: string): ChartFamily | undefined {
  return CHART_FAMILIES.find((f) => f.id === id);
}

export function familyPath(id: ChartFamilyId | string): string {
  return `/charts-page/${id}/`;
}

export function requiredContractNames(family: ChartFamily): string[] {
  return family.contract.filter((c) => c.required).map((c) => c.name);
}
