import { addDays, daysBetween, type IsoDate } from '../engines/calendar/dates.ts';
import { durationDays, type ScheduleTask } from '../engines/timeline/schedule.ts';

export const ZOOMS = ['day', 'week', 'month', 'quarter'] as const;
export type TimelineZoom = (typeof ZOOMS)[number];

/** CSS pixels per calendar day at each timeline zoom. */
export const DAY_WIDTH: Record<TimelineZoom, number> = {
  day: 48,
  week: 16,
  month: 5,
  quarter: 2,
};

export const ROW_HEIGHT = 44;
export const TASK_COLUMN_WIDTH = 250;
export const HEADER_HEIGHT = 48;

/**
 * Inclusive date range covering every task, padded by a week on each side.
 * When `today` falls outside the padded span it is expanded to include it.
 */
export function timelineRange(
  tasks: readonly ScheduleTask[],
  today?: IsoDate
): { start: IsoDate; end: IsoDate } {
  if (tasks.length === 0) {
    const anchor = today ?? '2026-01-15';
    return { start: addDays(anchor, -7), end: addDays(anchor, 14) };
  }
  const starts = tasks.map((task) => task.start).sort();
  const ends = tasks.map((task) => task.end).sort();
  const start = addDays(starts[0] as IsoDate, -7);
  const end = addDays(ends[ends.length - 1] as IsoDate, 14);
  return today
    ? {
        start: today < start ? addDays(today, -7) : start,
        end: today > end ? addDays(today, 14) : end,
      }
    : { start, end };
}

/** Day offset of `date` from range `start` (0 = first day). */
export function dateOffset(date: IsoDate, start: IsoDate): number {
  return daysBetween(start, date);
}

export function dateAtOffset(start: IsoDate, offset: number): IsoDate {
  return addDays(start, Math.round(offset));
}

/**
 * End dates are inclusive: a same-day task lasts one day; a milestone takes none.
 */
export function durationLabel(task: ScheduleTask): string {
  if (task.milestone) return 'Milestone';
  const days = durationDays(task);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function progressValue(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Every user-facing string of the timeline view. Defaults are the original
 * English strings; pass a partial `labels` prop to translate or reword.
 */
export interface TimelineLabels {
  /** The toolbar toggle's label, off and on. */
  milestonesOnly: string;
  showAllTasks: string;
  /** Name of the zoom button group. */
  zoomGroup: string;
  loading: string;
  loadError: string;
  retry: string;
  /** The notice shown when rows were truncated to `maxRows`. */
  truncated: (visible: number, total: number, hidden: number) => string;
  /** The notice and its inline action while milestones-only is on. */
  milestonesNotice: string;
  showAll: string;
  /** Name of the undated-tasks tray and its heading. */
  unscheduledTray: string;
  unscheduledHeading: string;
  /** Column headers of the task table. */
  columns: { task: string; start: string; end: string; duration: string };
  /** Name of the task table ("Launch plan tasks"). */
  tasksTable: (label: string) => string;
  empty: string;
  /** Live announcements around a reschedule. */
  saving: string;
  saved: (count: number) => string;
  saveFailed: string;
  cancelled: string;
  pickedUp: (title: string) => string;
  /** Dates arrive formatted for the locale ("June 2, 2026"). */
  preview: (title: string, start: string, end: string) => string;
  /** Visible chip on the today line. */
  todayLabel: string;
  /** Mark naming a task on the critical path. */
  criticalPath: string;
  /** `aria-roledescription` of a reschedulable task bar. */
  reschedulableTask: string;
  /** Bar suffixes: a milestone, and while its save is pending. */
  milestoneSuffix: string;
  savingSuffix: string;
  /** The Duration cell; a milestone takes no days. */
  duration: (days: number, milestone: boolean) => string;
}

export const DEFAULT_TIMELINE_LABELS: TimelineLabels = {
  milestonesOnly: 'Milestones only',
  showAllTasks: 'Show all tasks',
  zoomGroup: 'Timeline zoom',
  loading: 'Loading timeline…',
  loadError: 'Could not load the timeline.',
  retry: 'Retry',
  truncated: (visible, total, hidden) =>
    `Showing ${visible} of ${total} scheduled tasks; ${hidden} are hidden.`,
  milestonesNotice: 'Showing only milestone tasks',
  showAll: 'Show all',
  unscheduledTray: 'Unscheduled tasks',
  unscheduledHeading: 'Unscheduled',
  columns: { task: 'Task', start: 'Start', end: 'End', duration: 'Duration' },
  tasksTable: (label) => `${label} tasks`,
  empty: 'No scheduled tasks in this range.',
  saving: 'Saving schedule changes…',
  saved: (count) => `Saved ${count} schedule change${count === 1 ? '' : 's'}.`,
  saveFailed: 'The schedule was not saved; dates were restored.',
  cancelled: 'Reschedule cancelled.',
  pickedUp: (title) =>
    `Picked up ${title}. Use arrow keys to adjust dates; Enter saves, Escape cancels.`,
  preview: (title, start, end) => `${title} preview: ${start} to ${end}.`,
  todayLabel: 'Today',
  criticalPath: 'Critical path',
  reschedulableTask: 'reschedulable task',
  milestoneSuffix: 'milestone',
  savingSuffix: 'saving',
  duration: (days, milestone) => (milestone ? 'Milestone' : `${days} day${days === 1 ? '' : 's'}`),
};

/**
 * Physical pixel position along the time axis for canvas and SVG drawing,
 * which cannot mirror with `dir`: RTL mirrors from the inline-end edge. CSS
 * insets use the logical properties and need no mirror.
 */
export function axisPixel(
  dayOffset: number,
  dayWidth: number,
  canvasWidth: number,
  direction: 'ltr' | 'rtl'
): number {
  const ltr = dayOffset * dayWidth;
  return direction === 'rtl' ? canvasWidth - ltr : ltr;
}
