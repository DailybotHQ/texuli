import { defineExample } from '../registry.ts';

export const canvasChartsExample = defineExample({
  id: 'charts-canvas',
  title: 'Canvas charts at scale',
  description:
    'A 100,000-point series rendered on Canvas in light and dark themes, with an accessible description and data table.',
  tags: ['charts', 'canvas', 'performance', 'accessibility'],
  component: 'charts/canvas',
  props: ['series', 'mode', 'renderer'],
  load: () => import('./CanvasChartsDemo.svelte'),
});
