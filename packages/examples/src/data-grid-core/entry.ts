import { defineExample } from '../registry.ts';

export const dataGridCoreExample = defineExample({
  id: 'data-grid-core',
  title: 'Data grid',
  description:
    'Sortable columns (Shift for more keys), search, a filter, row selection and APG grid keyboard navigation on the texuli Table, with an RTL grid. Fictional deals.',
  tags: ['data', 'grid', 'table', 'keyboard', 'rtl'],
  component: 'data/grid-core',
  props: ['rows', 'columns', 'sort', 'search', 'filter', 'selectable', 'selected', 'labels'],
  load: () => import('./DataGridCoreDemo.svelte'),
});
