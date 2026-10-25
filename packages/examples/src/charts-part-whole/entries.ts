import { defineExample } from '../registry.ts';

export const chartsPartWholeExample = defineExample({
  id: 'charts-part-whole',
  title: 'Part-whole charts',
  description:
    'Pie, donut, treemap and sunburst views with accessible descriptions and expandable data tables in light and dark token palettes.',
  tags: ['charts', 'pie', 'donut', 'treemap', 'sunburst'],
  component: 'charts/part-whole',
  props: ['data', 'root', 'labels'],
  load: () => import('./PartWholeChartsDemo.svelte'),
});
