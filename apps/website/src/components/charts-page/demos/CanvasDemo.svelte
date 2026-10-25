<script lang="ts">
import { AreaChart, type CartesianSeries, LineChart } from '@texuli/charts/cartesian';

/** Deterministic dense series (under canvas threshold for site load; still forces canvas). */
const SAMPLE_COUNT = 512;
const points = Array.from({ length: SAMPLE_COUNT }, (_, x) => ({
  x,
  y: 24 + Math.sin(x / 40) * 9 + Math.sin(x / 11) * 2,
}));
const series: CartesianSeries[] = [{ id: 'traffic', label: 'Daily activity', points }];
</script>

<div class="grid" data-tx-charts-demo="canvas">
  <LineChart
    title="Daily activity (canvas)"
    description="Five hundred twelve deterministic daily activity samples on the canvas renderer."
    {series}
    renderer="canvas"
  />
  <AreaChart
    title="Activity area (canvas)"
    description="The same samples as a filled canvas area chart."
    {series}
    renderer="canvas"
  />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.25rem;
  }
</style>
