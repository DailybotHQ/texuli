import { defineExample } from '../registry.ts';

export const playerDashboardExample = defineExample({
  id: 'player-dashboard',
  title: 'Player: painted dashboard',
  description:
    'The Player paints a fictional fleet dashboard blueprint: a KPI row, a two-column grid of line, donut, bar and gauge charts, and an incidents table.',
  tags: ['player', 'dashboard', 'charts', 'catalog'],
  component: 'player/Player',
  props: ['blueprint', 'label'],
  load: () => import('./DashboardDemo.svelte'),
});
