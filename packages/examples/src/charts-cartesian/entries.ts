import { defineExample } from '../registry.ts';

export const cartesianChartsExample = defineExample({
  id: 'charts-cartesian',
  title: 'Cartesian charts',
  description:
    'Line, area, grouped bar, stacked bar and combo charts with descriptions and table fallbacks in light and dark modes.',
  tags: ['charts', 'line', 'area', 'bar', 'accessibility'],
  component: 'charts/cartesian',
  props: ['series', 'mode', 'description'],
  load: () => import('./CartesianChartsDemo.svelte'),
});
