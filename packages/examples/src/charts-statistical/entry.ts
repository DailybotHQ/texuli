import { defineExample } from '../registry.ts';

export const chartsStatisticalExample = defineExample({
  id: 'charts-statistical',
  title: 'Statistical charts',
  description:
    'Box plot, violin and ECDF charts summarize fictional response-time samples with theme tokens and data table fallbacks.',
  tags: ['charts', 'statistical', 'box-plot', 'violin', 'ecdf', 'accessibility'],
  component: 'charts/statistical',
  props: ['groups', 'series', 'domain', 'whisker', 'bandwidth'],
  load: () => import('./StatisticalChartsDemo.svelte'),
});
