import { defineExample } from '../registry.ts';

export const chartsFlowExample = defineExample({
  id: 'charts-flow',
  title: 'Flow charts',
  description:
    'Sankey, funnel and network graphs use token palettes, accessible descriptions and expandable data tables in light and dark modes.',
  tags: ['charts', 'flow', 'sankey', 'funnel', 'network', 'accessibility'],
  component: 'charts/flow',
  props: ['nodes', 'links', 'steps'],
  load: () => import('./FlowChartsDemo.svelte'),
});
