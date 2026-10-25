import { defineExample } from '../registry.ts';

export const chartsCompactExample = defineExample({
  id: 'charts-compact',
  title: 'Compact charts',
  description:
    'A sparkline, bullet chart, gauge and progress ring use the active theme tokens and include data table fallbacks.',
  tags: ['charts', 'compact', 'accessibility'],
  component: 'charts/CompactChartsDemo',
  props: ['values', 'value', 'target', 'max'],
  load: () => import('./CompactChartsDemo.svelte'),
});
