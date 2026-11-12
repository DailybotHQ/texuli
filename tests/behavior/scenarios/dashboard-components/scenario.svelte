<script lang="ts">
import { Sparkline } from '@texuli/charts/sparkline-lite';
import type { FilterField } from '@texuli/data/filter-builder';
import { MetricCard } from '../../../../packages/data/src/dashboard/index.ts';
import type { FilterGroup } from '../../../../packages/data/src/engines/grid/filter.ts';
import { FilterBar } from '../../../../packages/data/src/filter-bar/index.ts';

let value = $state<FilterGroup>({
  type: 'group',
  op: 'and',
  children: [{ type: 'condition', field: 'region', operator: 'eq', value: 'North' }],
});
const fields: FilterField[] = [
  { key: 'region', header: 'Region', type: 'enum', options: ['North', 'South'] },
  { key: 'revenue', header: 'Revenue', type: 'number' },
];
</script>

<main class="dashboard-components" dir="ltr">
  <FilterBar fields={fields} bind:value saved={false} />
  <div class="dashboard-components__cards">
    <MetricCard title="Revenue" value="$48,290" trend="up" trendLabel="12%" comparison="vs. last period">
      {#snippet sparkline()}<Sparkline values={[2, 3, 4, 3, 6]} label="Revenue trend" />{/snippet}
    </MetricCard>
    <MetricCard title="Forecast" loading />
    <MetricCard title="Tickets" empty />
  </div>
</main>

<style>
  .dashboard-components { display: grid; gap: 1rem; max-inline-size: 56rem; padding: 1rem; }
  .dashboard-components__cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
</style>
