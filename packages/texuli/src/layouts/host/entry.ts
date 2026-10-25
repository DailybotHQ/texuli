/**
 * `texuli/layouts/host` entry: layout contract, registry and LayoutHost.
 * Chrome and drawer stay on the folder index / root barrel so this entry
 * stays within the default lazy budget when apps only need the host.
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
export { default as LayoutHost } from './LayoutHost.svelte';
export {
  closeWhenWide,
  layoutStorageKey,
  onNavigate,
  readFlag,
  writeFlag,
} from './layout-kit.ts';
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
