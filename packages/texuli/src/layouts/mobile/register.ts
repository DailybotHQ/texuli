/**
 * Light registration entry for mobile layouts (`texuli/layouts/mobile/register`).
 * One dynamic import per layout file so mobile-tabs and mobile-drawer stay
 * separate chunks. No static Svelte component imports.
 */
import type { LayoutId } from '../host/contract.ts';
import { registerLayout, unregisterLayout } from '../host/registry.ts';

const MOBILE_LAYOUT_IDS = ['mobile-tabs', 'mobile-drawer'] as const satisfies readonly LayoutId[];

/** Separate loaders — do not share a single import() expression or factory. */
const loadMobileTabs = () => import('./MobileTabsLayout.svelte');
const loadMobileDrawer = () => import('./MobileDrawerLayout.svelte');

/** Lazy entries for LayoutHost; each import is its own chunk. */
export const MOBILE_LAYOUTS = Object.freeze({
  'mobile-tabs': { load: loadMobileTabs, owner: 'mobile' as const },
  'mobile-drawer': { load: loadMobileDrawer, owner: 'mobile' as const },
});

/** Registers both mobile layouts. Safe to call again. */
export function registerMobileLayouts(): void {
  registerLayout('mobile-tabs', MOBILE_LAYOUTS['mobile-tabs']);
  registerLayout('mobile-drawer', MOBILE_LAYOUTS['mobile-drawer']);
}

/** Removes the mobile host entries (tests). */
export function unregisterMobileLayouts(): void {
  for (const id of MOBILE_LAYOUT_IDS) unregisterLayout(id);
}

export { MOBILE_LAYOUT_IDS };
