/**
 * `@texuli/data/timeline` — virtualized Gantt timeline with dependencies,
 * zoom, critical path, and keyboard/pointer rescheduling.
 * Scheduling math lives in the framework-free engine (`../engines/timeline`).
 */

// Re-export the engine so one lazy subpath covers schedule + view.
export {
  type CascadeResult,
  type CriticalPath,
  cascade,
  criticalPath,
  cycleMessage,
  DEPENDENCY_TYPES,
  type Dependency,
  DependencyListSchema,
  DependencySchema,
  type DependencyType,
  durationDays,
  type ScheduleInfo,
  type ScheduleTask,
  type TaskChange,
  type TimelineBand,
  type TimelineGroup,
  type TimelineItem,
  type TimelineModel,
  type TimelineTone,
  type TopoResult,
  timelineModel,
  topoOrder,
  type WorkCalendar,
  type WorkDays,
  workDays,
} from '../engines/timeline/index.ts';
export {
  axisPixel,
  DAY_WIDTH,
  DEFAULT_TIMELINE_LABELS,
  dateAtOffset,
  dateOffset,
  durationLabel,
  formatTimelineTick,
  HEADER_HEIGHT,
  markerOffset,
  progressValue,
  ROW_HEIGHT,
  TASK_COLUMN_WIDTH,
  type TimelineLabels,
  type TimelineMarker,
  type TimelineTickContext,
  type TimelineZoom,
  timelineAnchor,
  timelineRange,
  ZOOMS,
} from './model.ts';
export { default as TimelineView } from './TimelineView.svelte';
