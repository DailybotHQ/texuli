import { registerLayout } from '../host/registry.ts';

/**
 * Register app layouts with LayoutHost. Each loader is a distinct import so
 * choosing one layout does not load the other layout implementations.
 * Promises are created once so concurrent hosts and tests share one chunk load.
 */

const loadSidebar = () => import('./SidebarLayout.svelte');
const loadTopNav = () => import('./TopNavLayout.svelte');
const loadDualSidebar = () => import('./DualSidebarLayout.svelte');
const loadRail = () => import('./RailLayout.svelte');
const loadMasterDetail = () => import('./MasterDetailLayout.svelte');

/**
 * App chrome layouts only. Does **not** register `mobile-drawer` / `mobile-tabs`
 * — those belong to `registerMobileLayouts()` so one id has one owner.
 */
export function registerAppLayouts(): void {
  registerLayout('sidebar', { load: loadSidebar, owner: 'app' });
  registerLayout('top-nav', { load: loadTopNav, owner: 'app' });
  registerLayout('dual-sidebar', { load: loadDualSidebar, owner: 'app' });
  registerLayout('rail', { load: loadRail, owner: 'app' });
  registerLayout('master-detail', { load: loadMasterDetail, owner: 'app' });
}

export { loadDualSidebar, loadMasterDetail, loadRail, loadSidebar, loadTopNav };
