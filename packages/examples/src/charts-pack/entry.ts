import { defineExample } from '../registry.ts';

export const chartsPackExample = defineExample({
  id: 'charts-pack',
  title: 'Pack chart',
  description:
    'Fictional team capacity is shown as nested circles backed by the public pack layout math.',
  tags: ['charts', 'pack', 'hierarchy', 'accessibility'],
  component: 'charts/PackChart',
  props: ['root', 'padding'],
  load: () => import('./PackChartDemo.svelte'),
});
