import { defineExample } from '../registry.ts';

export const chartsInteractionExample = defineExample({
  id: 'charts-interaction',
  title: 'Chart interaction',
  description:
    'Keyboard and pointer exploration, tooltips, legend series toggles, brush and zoom hooks, and a data table. Fictional Harbor Notes metrics.',
  tags: ['charts', 'interaction', 'a11y', 'keyboard'],
  component: 'charts/interaction',
  props: ['series', 'hidden', 'formatters', 'onselect'],
  load: () => import('./ChartsInteractionDemo.svelte'),
});
