import { defineExample } from '../registry.ts';

export const chartsCalendarExample = defineExample({
  id: 'charts-calendar',
  title: 'Calendar heatmap',
  description:
    'A UTC calendar grid shows fictional daily activity with sequential tokens and explicit missing days.',
  tags: ['charts', 'calendar', 'heatmap', 'accessibility'],
  component: 'charts/CalendarHeatmap',
  props: ['start', 'end', 'values', 'weekStartsOn'],
  load: () => import('./CalendarHeatmapDemo.svelte'),
});
