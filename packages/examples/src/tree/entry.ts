import { defineExample } from '../registry.ts';

export const texuliTreeExample = defineExample({
  id: 'texuli-tree',
  title: 'TreeView',
  description:
    'A nested tree with keyboard navigation, expandable folders, single and multiple selection, disabled items, density variants, RTL and dark mode. Fictional content only.',
  tags: ['texuli', 'tree', 'navigation', 'selection', 'keyboard', 'rtl', 'dark'],
  component: 'texuli/TreeView',
  props: ['items', 'expanded', 'selected', 'selectionMode', 'variant', 'density'],
  load: () => import('./TreeDemo.svelte'),
});
