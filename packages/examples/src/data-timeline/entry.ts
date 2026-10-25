import { defineExample } from '../registry.ts';

export const dataTimelineExample = defineExample({
  id: 'data-timeline',
  title: 'Timeline and Gantt',
  description:
    'Time-scaled Gantt with dependencies, zoom, critical path, RTL and keyboard rescheduling on a fictional launch plan.',
  tags: ['data', 'timeline', 'gantt', 'keyboard', 'rtl'],
  component: 'data/timeline',
  props: ['tasks', 'dependencies', 'zoom', 'direction', 'now'],
  load: () => import('./TimelineDemo.svelte'),
});
