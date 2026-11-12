<script lang="ts">
import { Sparkline } from '@texuli/charts/sparkline-lite';
import { FilterBar, type FilterGroup } from '@texuli/data';
import { MetricCard } from '@texuli/data/dashboard';
import type { FilterField } from '@texuli/data/filter-builder';
import { DateRangePicker } from 'texuli/date';

const today = '2026-03-10';
let period = $state({ start: '2026-03-01', end: '2026-03-10' });
let filters = $state<FilterGroup>({
  type: 'group',
  op: 'and',
  children: [{ type: 'condition', field: 'region', operator: 'eq', value: 'North' }],
});
const fields: FilterField[] = [
  { key: 'region', header: 'Region', type: 'enum', options: ['North', 'South', 'West'] },
  { key: 'revenue', header: 'Revenue', type: 'number' },
  { key: 'account', header: 'Account', type: 'text' },
];
const revenue = [12, 15, 13, 18, 17, 22, 24, 21, 28, 31];
const accounts = [4, 5, 5, 6, 7, 6, 8, 9, 9, 11];
</script>

<section class="dashboard-metrics" data-example="data-dashboard-metrics" aria-labelledby="dashboard-metrics-title">
  <header>
    <h2 id="dashboard-metrics-title">Revenue overview</h2>
    <DateRangePicker label="Reporting period" bind:value={period} presets today={today} maxDays={90} />
  </header>
  <FilterBar fields={fields} bind:value={filters} saved={false} />
  <div class="dashboard-metrics__grid">
    <MetricCard title="Revenue" value="$48,290" comparison="vs. previous period" trend="up" trendLabel="12%" >
      {#snippet sparkline()}<Sparkline values={revenue} label="Revenue trend over the reporting period" period="Mar 1–10" />{/snippet}
    </MetricCard>
    <MetricCard title="Active accounts" value="1,284" comparison="vs. previous period" trend="up" trendLabel="4.8%">
      {#snippet sparkline()}<Sparkline values={accounts} label="Active accounts trend over the reporting period" period="Mar 1–10" />{/snippet}
    </MetricCard>
    <MetricCard title="Conversion rate" value="3.6%" comparison="vs. previous period" trend="down" trendLabel="0.4 points" />
    <MetricCard title="Forecast" loading />
    <MetricCard title="Support tickets" empty />
  </div>
</section>

<style>
  .dashboard-metrics { display: grid; gap: 1.25rem; padding: 1.5rem; }
  .dashboard-metrics header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
  .dashboard-metrics h2 { margin: 0; }
  .dashboard-metrics__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: 1rem; }
</style>
