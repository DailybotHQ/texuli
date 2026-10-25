import { defineExample } from '../registry.ts';

export const dataTreeViewExample = defineExample({
  id: 'data-tree-view',
  title: 'Tree data view',
  description:
    'Outline tree with lazy folders, multi-select checkboxes, drag reorder and keyboard indent on fictional workspace pages.',
  tags: ['data', 'tree', 'keyboard', 'rtl', 'lazy'],
  component: 'data/tree-view',
  props: ['items', 'selected', 'expanded', 'checkboxes', 'loadChildren', 'onMove'],
  load: () => import('./TreeDataViewDemo.svelte'),
});
