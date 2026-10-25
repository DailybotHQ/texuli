<script lang="ts">
import { AreaChart, type CartesianSeries, LineChart } from '@texuli/charts/cartesian';

const points = Array.from({ length: 100_000 }, (_, x) => ({
  x,
  y: 24 + Math.sin(x / 700) * 9 + Math.sin(x / 31) * 2,
}));
const series: CartesianSeries[] = [{ id: 'traffic', label: 'Daily activity', points }];
</script>

<div class="gallery">
  <LineChart title="Daily activity at scale" description="One hundred thousand daily activity samples, rendered with the Canvas renderer." {series} />
  <AreaChart title="Activity area at scale" description="The same one hundred thousand daily activity samples, rendered as a filled Canvas area." {series} mode="dark" />
</div>

<style>
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr)); gap: 2rem; }
</style>
