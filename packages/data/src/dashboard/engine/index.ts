/**
 * `@texuli/data/dashboard/engine`: framework-free dashboard layout math
 * (packing, collision, moves and resizes, keyboard steps, breakpoints,
 * persistence) with hostile-input bounds. No Svelte and no DOM: use it in
 * Node, behind a view of your own, or under the `Dashboard` component of
 * `@texuli/data/dashboard`.
 */
export {
  DEFAULT_DASHBOARD_BREAKPOINTS,
  dashboardBreakpoints,
  layoutForBreakpoint,
  normalizeBreakpoints,
  reflowLayout,
  resolveBreakpoint,
} from './breakpoints.ts';
export {
  cellFromDelta,
  type DashboardKeyIntent,
  type DashboardKeyLike,
  dashboardKeyIntent,
} from './keyboard.ts';
export {
  addItem,
  compactLayout,
  compareItems,
  defaultSize,
  firstFit,
  layoutBottom,
  moveItem,
  normalizeItem,
  normalizeLayout,
  nudgeItem,
  overlaps,
  removeItem,
  resizeItem,
  sameLayout,
  sizeBounds,
  sortLayout,
} from './layout.ts';
export { clampColumns, DASHBOARD_LIMITS, isDashboardId } from './limits.ts';
export {
  type DashboardMessage,
  type DashboardMessages,
  type DashboardMessagesOverrides,
  type DashboardMessageValues,
  DEFAULT_DASHBOARD_MESSAGES,
  formatDashboardMessage,
  formatDashboardRefusal,
  positionValues,
  resolveDashboardMessages,
} from './messages.ts';
export {
  type DashboardLayoutDiff,
  dashboardState,
  diffLayout,
  type ParseDashboardOptions,
  type ParsedDashboard,
  parseDashboard,
  serializeDashboard,
} from './persist.ts';
export type {
  DashboardBreakpoint,
  DashboardChange,
  DashboardCompaction,
  DashboardGridOptions,
  DashboardIssue,
  DashboardItem,
  DashboardLayout,
  DashboardRefusal,
  DashboardState,
} from './types.ts';
