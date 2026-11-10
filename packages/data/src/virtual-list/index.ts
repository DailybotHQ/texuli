/**
 * `@texuli/data/virtual-list`: the windowed list engine (`createVirtualList`,
 * `nextVirtualListIndex`, `createInfiniteLoader`) and `VirtualListView`, the
 * catalog component (`data-virtual-list`) that renders it as an APG listbox.
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
  normalizeVirtualListSize,
  VIRTUAL_LIST_DENSITIES,
  VIRTUAL_LIST_SIZES,
  type VirtualListKeyValue,
  type VirtualListRowContext,
  type VirtualListViewDensity,
  type VirtualListViewSize,
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
