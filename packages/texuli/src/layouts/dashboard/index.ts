/**
 * `texuli/layouts/dashboard` — dashboard-grid layout and analytics widget grid
 * for direct import. Registration lives on
 * `texuli/layouts/dashboard/register` so LayoutHost setup stays light.
 */

export { default as AnalyticsGrid } from './AnalyticsGrid.svelte';
export { default as DashboardGridLayout } from './DashboardGridLayout.svelte';
export {
  DASHBOARD_LAYOUT_IDS,
  loadDashboardGrid,
  registerDashboardLayouts,
  unregisterDashboardLayouts,
} from './register.ts';
