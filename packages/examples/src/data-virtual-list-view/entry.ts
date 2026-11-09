import { defineExample } from '../registry.ts';

export const dataVirtualListViewExample = defineExample({
  id: 'data-virtual-list-view',
  title: 'Virtual list view',
  description:
    'A 10,000-row team feed windowed by the VirtualListView catalog component: rows through a snippet, keyboard selection and position announcements, with no inline style in the page.',
  tags: ['data', 'virtualization', 'keyboard', 'listbox'],
  component: 'data/VirtualListView',
  props: ['items', 'label', 'row', 'estimateSize', 'overscan', 'size', 'density', 'selected'],
  load: () => import('./VirtualListViewDemo.svelte'),
});
