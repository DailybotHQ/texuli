import { defineExample } from '../registry.ts';

export const dataDashboardMetricsExample = defineExample({
  id: 'data-dashboard-metrics',
  title: 'Dashboard metrics and filters',
  description:
    'A reporting period picker, removable applied-filter chips with the full filter builder, and metric cards with accessible sparklines, comparison, loading and empty states.',
  tags: ['data', 'dashboard', 'filters', 'metrics', 'date'],
  component: 'data/dashboard-metrics',
  props: ['value', 'fields', 'saved', 'trend', 'sparkline'],
  load: () => import('./DashboardMetricsDemo.svelte'),
});
