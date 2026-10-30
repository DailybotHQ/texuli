import { defineExample } from '../registry.ts';

export const dataDashboardExample = defineExample({
  id: 'data-dashboard',
  title: 'Dashboard',
  description:
    'A widget grid people rearrange: move and resize handles for pointer drags, the arrow keys with announced positions and a click-to-arrange toolbar, breakpoints that reflow to one column, and a layout saved as JSON.',
  tags: ['data', 'dashboard', 'keyboard', 'drag', 'responsive'],
  component: 'data/dashboard',
  props: ['label', 'layout', 'layouts', 'columns', 'editable', 'onLayoutChange'],
  load: () => import('./DataDashboardDemo.svelte'),
});
