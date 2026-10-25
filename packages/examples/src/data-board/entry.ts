import { defineExample } from '../registry.ts';

export const dataBoardExample = defineExample({
  id: 'data-board',
  title: 'Kanban board',
  description:
    'Shows pointer and keyboard card moves, swimlane-ready board structure, RTL layout and work-in-progress limits.',
  tags: ['data', 'board', 'keyboard', 'rtl'],
  component: 'data/board',
  props: ['columns', 'items', 'lanes', 'canMove'],
  load: () => import('./DataBoardDemo.svelte'),
});
