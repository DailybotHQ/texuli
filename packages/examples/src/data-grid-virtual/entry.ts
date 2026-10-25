import { defineExample } from '../registry.ts';

export const dataGridVirtualExample = defineExample({
  id: 'data-grid-virtual',
  title: 'Virtualized data grid',
  description:
    'A two-axis virtualized grid keeps 100,000 fictional records and wide tables bounded to the visible rows and columns, with keyboard navigation and RTL support.',
  tags: ['data', 'grid', 'virtualization', 'keyboard', 'rtl'],
  component: 'data/grid-virtual',
  props: ['rows', 'columns', 'rowSize', 'overscanRows', 'overscanColumns'],
  load: () => import('./VirtualDataGridDemo.svelte'),
});
