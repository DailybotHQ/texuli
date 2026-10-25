import { defineExample } from '../registry.ts';

export const layoutsDashboardExample = defineExample({
  id: 'layouts-dashboard',
  title: 'Dashboard grid layout',
  description:
    'Dashboard-grid layout with top chrome, container-query widget spans and an analytics auto-fit KPI grid. LTR and RTL.',
  tags: ['layouts', 'dashboard', 'analytics', 'rtl', 'responsive'],
  component: 'texuli/layouts/dashboard',
  props: ['layout', 'nav', 'options', 'dir'],
  load: () => import('./LayoutsDashboardDemo.svelte'),
});
