import { defineExample } from '../registry.ts';

export const blocksDataExample = defineExample({
  id: 'blocks-data',
  title: 'Data blocks',
  description:
    'Table, stat, KPI and chart content blocks with validation and a hostile rejection sample. Fictional metrics only.',
  tags: ['blocks', 'table', 'stat', 'chart', 'kpi'],
  component: 'blocks/data',
  props: ['type', 'columns', 'rows', 'items', 'kind', 'series'],
  load: () => import('./DataBlocksDemo.svelte'),
});
