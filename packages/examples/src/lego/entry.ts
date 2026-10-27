import { defineExample } from '../registry.ts';

export const legoExample = defineExample({
  id: 'lego',
  title: 'Player: lego composition',
  description:
    'One JSON blueprint composes layouts, a board, charts, media, blocks, a block palette, a page outline and a workflow editor. Cards move between columns and palette blocks copy into the outline, all through reorder, bindings and closed actions.',
  tags: ['player', 'composition', 'drag', 'workflows', 'state'],
  component: 'player/Player',
  props: ['blueprint', 'label'],
  load: () => import('./LegoDemo.svelte'),
});
