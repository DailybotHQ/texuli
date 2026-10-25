import { defineExample } from '../registry.ts';

export const texuliAppLayoutsExample = defineExample({
  id: 'texuli-app-layouts',
  title: 'App layouts',
  description:
    'Responsive sidebar, icon rail, master-detail, top navigation, split view and three-pane layouts with fictional workspace content.',
  tags: ['texuli', 'layouts', 'navigation', 'responsive', 'rtl', 'rail', 'master-detail'],
  component: 'texuli/layouts/app',
  props: ['layout', 'nav', 'aside', 'dir', 'detailActive', 'options'],
  load: () => import('./LayoutsAppDemo.svelte'),
});
