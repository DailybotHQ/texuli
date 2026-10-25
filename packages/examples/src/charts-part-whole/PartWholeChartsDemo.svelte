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
  label: 'Example Co.',
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

<section class="demo" aria-labelledby="part-whole-demo-title">
  <h2 id="part-whole-demo-title">Part-whole charts</h2>
  <p>Values use fictional quarterly revenue, in millions.</p>

  <section class="mode light" data-tx-mode="light" aria-labelledby="light-mode-title">
    <h3 id="light-mode-title">Light mode</h3>
    <div class="charts">
      <PieChart
        title="Revenue mix"
        description="Platform is the largest part, followed by services, support and other revenue."
        data={revenue}
        {labels}
      />
      <DonutChart
        title="Revenue share"
        description="The donut shows the same revenue mix with the total in its center."
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
        description="The inner ring groups product and services; the outer ring shows their parts."
        root={hierarchy}
        {labels}
      />
    </div>
  </section>

  <section class="mode dark" data-tx-mode="dark" aria-labelledby="dark-mode-title">
    <h3 id="dark-mode-title">Dark mode</h3>
    <div class="charts">
      <PieChart
        title="Revenue mix"
        description="Platform is the largest part, followed by services, support and other revenue."
        data={revenue}
        {labels}
      />
      <DonutChart
        title="Revenue share"
        description="The donut shows the same revenue mix with the total in its center."
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
        description="The inner ring groups product and services; the outer ring shows their parts."
        root={hierarchy}
        {labels}
      />
    </div>
  </section>
</section>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
  }

  .demo > h2,
  .demo > p,
  .mode > h3 {
    margin-block: 0;
  }

  .mode {
    border: 1px solid var(--tx-border);
    border-radius: 0.75rem;
    padding: 1rem;
  }

  .mode.light {
    --tx-background: #ffffff;
    --tx-foreground: #17212b;
    --tx-muted-foreground: #465463;
    --tx-border: #71808f;
    --tx-primary: #005f73;
    --tx-success: #315c27;
    --tx-info: #164e9b;
    --tx-warning: #784900;
    --tx-destructive: #a62020;
    --tx-secondary: #5d3e8c;
    --tx-accent: #8b3c6c;
    --tx-link: #005ea8;
    --tx-chart-1: #005f73;
    --tx-chart-2: #315c27;
    --tx-chart-3: #164e9b;
    --tx-chart-4: #784900;
    --tx-chart-5: #a62020;
    --tx-chart-6: #5d3e8c;
    --tx-chart-7: #8b3c6c;
    --tx-chart-8: #005ea8;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }

  .mode.dark {
    --tx-background: #121820;
    --tx-foreground: #f0f4f8;
    --tx-muted-foreground: #c0ccd8;
    --tx-border: #8394a5;
    --tx-primary: #68d8e8;
    --tx-success: #9bd97d;
    --tx-info: #9fc5ff;
    --tx-warning: #ffd078;
    --tx-destructive: #ff9999;
    --tx-secondary: #d1b4ff;
    --tx-accent: #ffacd8;
    --tx-link: #a7cfff;
    --tx-chart-1: #68d8e8;
    --tx-chart-2: #9bd97d;
    --tx-chart-3: #9fc5ff;
    --tx-chart-4: #ffd078;
    --tx-chart-5: #ff9999;
    --tx-chart-6: #d1b4ff;
    --tx-chart-7: #ffacd8;
    --tx-chart-8: #a7cfff;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }

  .charts {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    margin-block-start: 1rem;
  }

  @media (forced-colors: active) {
    .mode {
      border-color: CanvasText;
    }
  }

  @media (forced-colors: active) {
    .mode, .dark, [data-tx-mode="dark"] {
      background: Canvas !important;
      color: CanvasText !important;
      border-color: CanvasText !important;
      --tx-background: Canvas;
      --tx-foreground: CanvasText;
      --tx-muted-foreground: CanvasText;
      --tx-border: CanvasText;
      --tx-surface: Canvas;
      --tx-primary: Highlight;
      --tx-primary-foreground: HighlightText;
    }
  }
</style>
