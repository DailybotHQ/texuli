import { defineExample } from '../registry.ts';

export const dataFilterBuilderExample = defineExample({
  id: 'data-filter-builder',
  title: 'Filter builder',
  description:
    'Nested and/or groups with operators by field type, native keyboard controls and focus that follows each add and remove; the model filters a data grid and is shown as JSON. Fictional deals.',
  tags: ['data', 'filter', 'grid', 'keyboard'],
  component: 'data/filter-builder',
  props: ['fields', 'value', 'maxDepth', 'labels'],
  load: () => import('./FilterBuilderDemo.svelte'),
});
