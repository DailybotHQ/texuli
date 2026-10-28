import { defineExample } from '../registry.ts';

export const primitivesSortableExample = defineExample({
  id: 'primitives-sortable',
  title: 'Sortable',
  description:
    'Owned drag and drop on @texuli/drag: a board with columns, a nested outline, right-to-left chips, a palette that clones, a swap grid, locked items and multi-select. Keyboard pick-up, move, drop and cancel, with localized announcements. Fictional content only.',
  tags: ['primitives', 'sortable', 'drag', 'keyboard', 'a11y', 'rtl'],
  component: 'primitives/Sortable',
  props: [
    'containers',
    'selection',
    'mode',
    'preview',
    'crossContainers',
    'nestZone',
    'messages',
    'onMove',
  ],
  load: () => import('./SortableDemo.svelte'),
});
