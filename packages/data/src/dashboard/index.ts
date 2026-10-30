/**
 * `@texuli/data/dashboard`: the `Dashboard` widget grid and its
 * `DashboardWidget` children, plus the framework-free engine. For plain
 * Node, import `@texuli/data/dashboard/engine` instead: this entry carries
 * the Svelte components.
 */
export type { DashboardContext, DashboardWidgetEntry } from './context.ts';
export { default as Dashboard } from './Dashboard.svelte';
export { default as DashboardWidget } from './DashboardWidget.svelte';
export * from './engine/index.ts';
export {
  type DashboardLabelOverrides,
  type DashboardLabels,
  DEFAULT_DASHBOARD_LABELS,
} from './labels.ts';
