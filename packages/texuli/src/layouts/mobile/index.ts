/**
 * `texuli/layouts/mobile` — framework-free model helpers, registration, and
 * the standalone mobile parts (`BottomNav`, `MobileHeader`, `MobileAppFrame`).
 * Prefer `texuli/layouts/mobile/register` when you only need registerMobileLayouts
 * (keeps layout components out of the cold path).
 *
 * The registered layouts stay on their own files; this index does not
 * statically import MobileTabsLayout or MobileDrawerLayout. The standalone
 * parts are side-effect-free re-exports, so a bundler can drop them when an
 * app imports only the model helpers.
 */

export { default as BottomNav } from './BottomNav.svelte';
export { type MobileLabels, mobileLabels } from './labels.ts';
export { default as MobileAppFrame } from './MobileAppFrame.svelte';
export { default as MobileHeader } from './MobileHeader.svelte';
export {
  type BottomNavItem,
  bottomNavCurrent,
  currentHashPath,
  MOBILE_TAB_LIMIT,
  navCurrent,
  type StackHeader,
  splitTabs,
  stackHeader,
  topLevelItems,
} from './model.ts';
export {
  MOBILE_LAYOUT_IDS,
  MOBILE_LAYOUTS,
  registerMobileLayouts,
  unregisterMobileLayouts,
} from './register.ts';
