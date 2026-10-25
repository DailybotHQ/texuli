import { defineExample } from '../registry.ts';

export const dataGridEditingVirtualExample = defineExample({
  id: 'data-grid-editing-virtual',
  title: 'Editable grid, 100,000 rows',
  description:
    'The editable data grid windows its rows above a threshold: 100,000 fictional records stay editable, with inline edits, the active cell and keyboard navigation kept across scrolling.',
  tags: ['data', 'grid', 'editing', 'virtualization', 'keyboard', 'a11y'],
  component: 'data/grid-editing',
  props: [
    'rows',
    'columns',
    'onCommit',
    'virtualizeAbove',
    'rowSize',
    'viewportHeight',
    'overscanRows',
  ],
  load: () => import('./EditableVirtualGridDemo.svelte'),
});
