/**
 * `@texuli/data/virtual-list`: the windowed list engine (`createVirtualList`,
 * `nextVirtualListIndex`, `createInfiniteLoader`) and `VirtualListView`, the
 * catalog component (`data-virtual-list`) that renders it as an APG listbox
 * or, with `mode="feed"`, as an APG feed of articles.
 */
export {
  createInfiniteLoader,
  type InfiniteLoader,
  type InfiniteLoaderOptions,
  type InfiniteLoaderStatus,
} from './infinite-loader.ts';
export { default as VirtualListView } from './VirtualListView.svelte';
export {
  normalizeVirtualListDensity,
  normalizeVirtualListMode,
  normalizeVirtualListSize,
  normalizeVirtualListSurface,
  VIRTUAL_LIST_DENSITIES,
  VIRTUAL_LIST_MODES,
  VIRTUAL_LIST_SIZES,
  VIRTUAL_LIST_SURFACES,
  type VirtualListKeyValue,
  type VirtualListRowContext,
  type VirtualListViewDensity,
  type VirtualListViewMode,
  type VirtualListViewSize,
  type VirtualListViewSurface,
  viewportFallback,
  virtualListDescriptionOf,
  virtualListKeyOf,
  virtualListLabelOf,
} from './view-model.ts';
export {
  createVirtualList,
  nextVirtualListIndex,
  type VirtualList,
  type VirtualListDirection,
  type VirtualListItem,
  type VirtualListKey,
  type VirtualListNavigationOptions,
  type VirtualListOptions,
  type VirtualListOrientation,
  type VirtualListWindow,
} from './virtual-list.ts';
