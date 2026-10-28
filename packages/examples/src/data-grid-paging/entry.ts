import { defineExample } from '../registry.ts';

export const dataGridPagingExample = defineExample({
  id: 'data-grid-paging',
  title: 'Data grid paging and bulk actions',
  description:
    'Client paging with a bound page and page size, row classes for overdue invoices, a filter and an export action in the toolbar, and bulk actions that follow the selection across pages. Fictional invoices.',
  tags: ['data', 'grid', 'table', 'paging', 'selection'],
  component: 'data/grid-core',
  props: ['pageSize', 'page', 'rowClass', 'toolbar', 'filters', 'bulkActions', 'selected'],
  load: () => import('./DataGridPagingDemo.svelte'),
});
