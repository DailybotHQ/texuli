<script lang="ts">
import {
  BubbleChart,
  type HeatmapCell,
  HeatmapChart,
  ScatterChart,
  type ScatterPoint,
} from '@texuli/charts/matrix';

const heatCells: HeatmapCell[] = [
  { x: 'Mon', y: 'Design', value: 2 },
  { x: 'Tue', y: 'Design', value: 5 },
  { x: 'Wed', y: 'Design', value: 3 },
  { x: 'Mon', y: 'Build', value: 4 },
  { x: 'Tue', y: 'Build', value: 7 },
  { x: 'Wed', y: 'Build', value: 6 },
  { x: 'Mon', y: 'Review', value: 1 },
  { x: 'Tue', y: 'Review', value: 2 },
  { x: 'Wed', y: 'Review', value: 8 },
];

const scatter: ScatterPoint[] = [
  { id: 's1', label: 'North desk', x: 12, y: 40, seriesId: 'on-site' },
  { id: 's2', label: 'East desk', x: 28, y: 22, seriesId: 'on-site' },
  { id: 's3', label: 'Remote A', x: 18, y: 55, seriesId: 'remote' },
  { id: 's4', label: 'Remote B', x: 35, y: 48, seriesId: 'remote' },
  { id: 's5', label: 'Lab', x: 8, y: 18, seriesId: 'on-site' },
];

const bubbles: ScatterPoint[] = [
  { id: 'b1', label: 'Alpha', x: 10, y: 30, r: 4, seriesId: 'core' },
  { id: 'b2', label: 'Beta', x: 25, y: 45, r: 9, seriesId: 'core' },
  { id: 'b3', label: 'Gamma', x: 40, y: 20, r: 6, seriesId: 'edge' },
  { id: 'b4', label: 'Delta', x: 32, y: 55, r: 12, seriesId: 'edge' },
];
</script>

<div class="grid" data-tx-charts-demo="matrix">
  <HeatmapChart
    title="Squad effort by day"
    description="Relative story points by squad and weekday. Fictional planning data."
    cells={heatCells}
  />
  <ScatterChart
    title="Latency versus throughput"
    description="Desks by requests per minute and p95 latency."
    points={scatter}
    series={[
      { id: 'on-site', label: 'On-site' },
      { id: 'remote', label: 'Remote' },
    ]}
  />
  <BubbleChart
    title="Service footprint"
    description="Services by error rate (x), traffic (y) and instance count (size)."
    points={bubbles}
    series={[
      { id: 'core', label: 'Core' },
      { id: 'edge', label: 'Edge' },
    ]}
  />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.25rem;
  }
</style>
