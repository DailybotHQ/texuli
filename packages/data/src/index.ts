// @texuli/data: entries are added by the PLAN_001 tasks that build this package (docs/ARCHITECTURE.md).

export {
  type InboxFilter,
  type InboxNotification,
  markAllRead,
  NotificationInbox,
  type NotificationInboxLabels,
  setRead,
  unreadCount,
} from './activity/inbox/index.ts';
export {
  ActivityFeed,
  type ActivityFeedLabels,
  type ActivityFilter,
  type ActivityItem,
  type ActivityKind,
} from './activity/index.ts';
export { Board, type BoardLabels } from './board/index.ts';
export {
  type CohortRow,
  CohortTable,
  type CohortTableLabels,
  cohortAverages,
} from './cohort/index.ts';
export {
  FileBrowser,
  type FileBrowserLabels,
  type FileBrowserLayout,
  type FileEntry,
  type FilePreviewModel,
} from './files/index.ts';
export {
  applyFilter,
  FilterBuilder,
  type FilterBuilderLabels,
  type FilterField,
  type FilterGroup,
  type FilterNode,
} from './filter-builder/index.ts';
export {
  ColumnGrid,
  type ColumnGridLabels,
  type ColumnGroupDef,
} from './grid-columns/index.ts';
export {
  DataGrid,
  type DataGridColumn,
  type DataGridColumnInput,
  type DataGridLabels,
  gridRows,
  moveCell,
  nextSort,
} from './grid-core/index.ts';
export {
  applyRowValue,
  cellKey,
  createUndoStack,
  type EditableColumn,
  EditableDataGrid,
  parseClipboard,
  parseEditorValue,
  serializeClipboard,
  validateCell,
} from './grid-editing/index.ts';
export { MapView } from './map/index.ts';
export {
  TimelineView,
  type TimelineZoom,
  ZOOMS,
} from './timeline/index.ts';
export {
  TreeDataView,
  type TreeDataViewLabels,
  type TreeMove,
  type TreePlacement,
} from './tree-view/index.ts';

export {
  createInfiniteLoader,
  createVirtualList,
  type InfiniteLoader,
  type InfiniteLoaderOptions,
  type InfiniteLoaderStatus,
  nextVirtualListIndex,
  type VirtualList,
  type VirtualListDirection,
  type VirtualListItem,
  type VirtualListKey,
  type VirtualListNavigationOptions,
  type VirtualListOptions,
  type VirtualListOrientation,
  type VirtualListWindow,
} from './virtual-list/index.ts';
