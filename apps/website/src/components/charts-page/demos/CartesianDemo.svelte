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

<div class="grid" data-tx-charts-demo="cartesian">
  <LineChart title="Account growth" description="New and returning Harbor Notes accounts each month." {series} />
  <AreaChart title="Accounts over time" description="Account additions by month as stacked areas." {series} />
  <BarChart title="Monthly accounts" description="Grouped new and returning accounts." {series} />
  <StackedBarChart title="Account mix" description="Monthly accounts stacked by type." {series} />
  <ComboChart
    title="Accounts and retention"
    description="New accounts as bars and returning accounts as a line."
    {series}
  />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.25rem;
  }
</style>
