/**
 * `texuli/layouts/mobile` — framework-free model helpers and registration.
 * Prefer `texuli/layouts/mobile/register` when you only need registerMobileLayouts
 * (keeps layout components out of the cold path).
 *
 * Direct layout components stay on their own files; this index does not
 * statically import MobileTabsLayout or MobileDrawerLayout.
 */

export { type MobileLabels, mobileLabels } from './labels.ts';
export {
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
