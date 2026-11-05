import { defineExample } from '../registry.ts';

export const dataBoardLanesExample = defineExample({
  id: 'data-board-lanes',
  title: 'Board with collapsible lanes',
  description:
    'A board with swimlanes: one lane starts collapsed behind its disclosure while its cards still count toward the column limits, and every column-by-lane cell ends with an add button that knows its column and lane.',
  tags: ['data', 'board', 'lanes'],
  component: 'data/board',
  props: ['lanes', 'collapsedLanes', 'cellFooter'],
  load: () => import('./DataBoardLanesDemo.svelte'),
});
