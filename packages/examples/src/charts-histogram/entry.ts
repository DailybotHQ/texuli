import { defineExample } from '../registry.ts';

export const chartsHistogramExample = defineExample({
  id: 'charts-histogram',
  title: 'Histogram chart',
  description:
    'A fictional response-time distribution uses math-backed bins, theme tokens and a data table fallback.',
  tags: ['charts', 'histogram', 'statistical', 'accessibility'],
  component: 'charts/HistogramChart',
  props: ['values', 'thresholds', 'binCount'],
  load: () => import('./HistogramChartDemo.svelte'),
});
