import { defineExample } from '../registry.ts';

export const blocksDataChartsExample = defineExample({
  id: 'blocks-data-charts',
  title: 'Chart blocks',
  description:
    'Chart content blocks across every chart family: pie, gauge, sankey, histogram, pack, calendar, combo, annotated line and scatter with series labels. Fictional metrics only.',
  tags: ['blocks', 'chart', 'charts', 'parity'],
  component: 'blocks/data',
  props: ['kind', 'title', 'description', 'series', 'points', 'props'],
  load: () => import('./ChartBlocksDemo.svelte'),
});
