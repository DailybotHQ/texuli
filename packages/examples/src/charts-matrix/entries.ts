import { defineExample } from '../registry.ts';

export const matrixChartsExample = defineExample({
  id: 'charts-matrix',
  title: 'Matrix charts',
  description:
    'Heatmap, scatter and bubble charts with accessible descriptions and data table fallbacks in light and dark modes. Fictional metrics only.',
  tags: ['charts', 'heatmap', 'scatter', 'bubble', 'accessibility'],
  component: 'charts/matrix',
  props: ['cells', 'points', 'series', 'mode', 'description'],
  load: () => import('./MatrixChartsDemo.svelte'),
});
