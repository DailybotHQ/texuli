import { defineExample } from '../registry.ts';

export const chartsWindowedExample = defineExample({
  id: 'charts-windowed',
  title: 'Windowed cartesian series',
  description:
    'A 200-request fictional latency series shown through a movable visibleDomain window: axes, marks and keyboard exploration follow the window.',
  tags: ['charts', 'cartesian', 'large-series', 'accessibility'],
  component: 'charts/LineChart',
  props: ['series', 'visibleDomain'],
  load: () => import('./WindowedChartDemo.svelte'),
});
