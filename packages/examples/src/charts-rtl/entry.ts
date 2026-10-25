import { defineExample } from '../registry.ts';

export const chartsRtlExample = defineExample({
  id: 'charts-rtl',
  title: 'Charts in right-to-left layouts',
  description:
    'Line, heatmap, scatter, sankey and gauge charts inside dir="rtl" with fictional Arabic labels: captions, legends and tables mirror, while each plot keeps a left-to-right coordinate system.',
  tags: ['charts', 'rtl', 'i18n', 'accessibility'],
  component: 'charts/rtl',
  props: ['title', 'description', 'series', 'cells', 'points', 'nodes', 'links', 'label'],
  load: () => import('./RtlChartsDemo.svelte'),
});
