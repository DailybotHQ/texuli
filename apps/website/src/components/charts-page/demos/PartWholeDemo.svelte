<script lang="ts">
import {
  DonutChart,
  type PartWholeDatum,
  type PartWholeTableLabels,
  type PartWholeTree,
  PieChart,
  SunburstChart,
  TreemapChart,
} from '@texuli/charts/part-whole';

const labels: PartWholeTableLabels = {
  table: 'Open data table',
  category: 'Category',
  value: 'Value',
};

const revenue: readonly PartWholeDatum[] = [
  { id: 'platform', label: 'Platform', value: 42 },
  { id: 'services', label: 'Services', value: 28 },
  { id: 'support', label: 'Support', value: 18 },
  { id: 'other', label: 'Other', value: 12 },
];

const hierarchy: PartWholeTree = {
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
        { id: 'implementation', label: 'Implementation', value: 24 },
        { id: 'training', label: 'Training', value: 16 },
      ],
    },
  ],
};
</script>

<div class="grid" data-tx-charts-demo="part-whole">
  <PieChart
    title="Revenue mix"
    description="Platform is the largest share, followed by services, support and other."
    data={revenue}
    {labels}
  />
  <DonutChart
    title="Revenue share"
    description="The same revenue mix with the total in the center."
    data={revenue}
    {labels}
  />
  <TreemapChart
    title="Revenue by team"
    description="Area encodes each product and service revenue amount."
    root={hierarchy}
    {labels}
  />
  <SunburstChart
    title="Revenue hierarchy"
    description="Inner ring groups product and services; outer ring shows their parts."
    root={hierarchy}
    {labels}
  />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 1.25rem;
  }
</style>
