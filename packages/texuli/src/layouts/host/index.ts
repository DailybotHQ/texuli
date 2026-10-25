/**
 * `texuli/layouts/host` — LayoutHost, layout contract, nav model and chrome.
 */

export {
  DEFAULT_LAYOUT,
  getLayout,
  isLayoutId,
  LAYOUT_IDS,
  LAYOUTS,
  type LayoutId,
  type LayoutOptions,
  type LayoutPlatform,
  type LayoutSettings,
  type LayoutSpec,
  layoutChoices,
  layoutForWidth,
  normalizeLayoutOptions,
} from './contract.ts';
export { default as LayoutChrome } from './LayoutChrome.svelte';
export { default as LayoutDrawer } from './LayoutDrawer.svelte';
export { default as LayoutHost } from './LayoutHost.svelte';
export {
  closeWhenWide,
  layoutStorageKey,
  onNavigate,
  readFlag,
  writeFlag,
} from './layout-kit.ts';
export { default as NavIcon } from './NavIcon.svelte';
export { NAV_ICON_BUILTINS, NAV_ICON_FALLBACK_PATH, navIconPath } from './nav-icons.ts';
export {
  isNavPathActive,
  type NavAction,
  type NavBadge,
  type NavIconName,
  type NavIconRef,
  type NavModel,
  type NavModelItem,
  type NavSection,
  type NavUser,
  navBadge,
  navPath,
  type ResolvedNavItem,
  type ResolvedNavSection,
  resolveNav,
} from './nav-model.ts';
export {
  clearLayoutRegistry,
  LAYOUT_OWNERS,
  LAYOUT_REGISTRY,
  type LayoutComponent,
  type LayoutEntry,
  type LayoutProps,
  loadLayout,
  registerLayout,
  unregisterLayout,
} from './registry.ts';
export { default as ScreenOutlet } from './ScreenOutlet.svelte';
export type { ChromePart } from './types.ts';
