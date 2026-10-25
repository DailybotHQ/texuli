/**
 * Light registration entry for dashboard-grid (`texuli/layouts/dashboard/register`).
 * Dynamic import only — no static DashboardGridLayout / AnalyticsGrid.
 */
import type { LayoutId } from '../host/contract.ts';
import { registerLayout, unregisterLayout } from '../host/registry.ts';

const DASHBOARD_LAYOUT_IDS = ['dashboard-grid'] as const satisfies readonly LayoutId[];

const loadDashboardGrid = () => import('./DashboardGridLayout.svelte');

/** Registers dashboard-grid on the layout host. Safe to call again. */
export function registerDashboardLayouts(): void {
  registerLayout('dashboard-grid', { load: loadDashboardGrid, owner: 'dashboard' });
}

/** Removes the dashboard host entry (tests). */
export function unregisterDashboardLayouts(): void {
  for (const id of DASHBOARD_LAYOUT_IDS) unregisterLayout(id);
}

export { DASHBOARD_LAYOUT_IDS, loadDashboardGrid };
