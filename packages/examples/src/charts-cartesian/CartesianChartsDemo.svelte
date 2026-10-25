<script lang="ts">
import {
  AreaChart,
  BarChart,
  type CartesianSeries,
  ComboChart,
  LineChart,
  StackedBarChart,
} from '@texuli/charts/cartesian';

const series: CartesianSeries[] = [
  {
    id: 'new',
    label: 'New accounts',
    points: [
      { x: 'Jan', y: 18 },
      { x: 'Feb', y: 25 },
      { x: 'Mar', y: 21 },
      { x: 'Apr', y: 32 },
    ],
  },
  {
    id: 'returning',
    label: 'Returning accounts',
    points: [
      { x: 'Jan', y: 9 },
      { x: 'Feb', y: 12 },
      { x: 'Mar', y: 14 },
      { x: 'Apr', y: 17 },
    ],
  },
];
</script>

<div class="gallery">
  <LineChart title="Account growth" description="New and returning accounts each month." {series} />
  <AreaChart title="Accounts over time" description="Stacked account additions by month." {series} mode="dark" />
  <BarChart title="Monthly accounts" description="Grouped new and returning accounts." {series} />
  <StackedBarChart title="Account mix" description="Monthly accounts stacked by type." {series} mode="dark" />
  <ComboChart title="Accounts and retention" description="New accounts as bars and returning accounts as a line." {series} />
</div>

<style>
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr)); gap: 2rem; }
</style>
