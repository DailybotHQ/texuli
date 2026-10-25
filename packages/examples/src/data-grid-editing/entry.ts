import { defineExample } from '../registry.ts';

export const dataGridEditingExample = defineExample({
  id: 'data-grid-editing',
  title: 'Editable data grid',
  description:
    'Inline cell editors with validation, undo/redo and TSV clipboard on the data grid. Fictional Harbor deals.',
  tags: ['data', 'grid', 'editing', 'keyboard', 'a11y'],
  component: 'data/grid-editing',
  props: ['rows', 'columns', 'onCommit', 'onApply', 'labels'],
  load: () => import('./DataGridEditingDemo.svelte'),
});
