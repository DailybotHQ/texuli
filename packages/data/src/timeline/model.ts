import { addDays, daysBetween, type IsoDate } from '../engines/calendar/dates.ts';
import {
  durationDays,
  type ScheduleTask,
  type TimelineTone,
} from '../engines/timeline/schedule.ts';

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

/**
 * A vertical marker on the time axis, such as the end of a review window.
 * `at` is a civil date (the start of that day) or an instant (a `Date` or an
 * ISO date-time, placed at its UTC time of day).
 */
export interface TimelineMarker {
  at: IsoDate | Date;
  label: string;
  tone?: TimelineTone;
}

/** Fractional day offset of a marker from range `start`; `NaN` when invalid. */
export function markerOffset(at: IsoDate | Date, start: IsoDate): number {
  const time =
    typeof at === 'string' && at.length === 10 ? Date.parse(`${at}T00:00Z`) : +new Date(at);
  return (time - Date.parse(`${start}T00:00Z`)) / 864e5;
}

/** What a tick label formatter gets besides the tick's civil date. */
export interface TimelineTickContext {
  zoom: TimelineZoom;
  locale: string;
  /** The first tick, or the first tick in a new month. */
  monthStart: boolean;
}

/**
 * The default axis tick label. Day ticks are one day wide, so they show the
 * day of month and name the month only where it starts ("Mar 1", "2", "3");
 * wider ticks keep the full date ("March 2, 2026").
 */
export function formatTimelineTick(date: IsoDate, context: TimelineTickContext): string {
  const day = context.zoom === 'day';
  return new Intl.DateTimeFormat(context.locale, {
    month: day ? (context.monthStart ? 'short' : undefined) : 'long',
    day: 'numeric',
    year: day ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * The day the axis opens at: a valid `initialDate` (a civil date, a `Date` or
 * an ISO date-time, read in UTC), else `today` when it falls between the
 * earliest start and the latest end, else none (the axis opens at its start).
 */
export function timelineAnchor(
  tasks: readonly ScheduleTask[],
  today: IsoDate,
  initialDate?: IsoDate | Date
): IsoDate | undefined {
  const offset = initialDate === undefined ? Number.NaN : markerOffset(initialDate, today);
  if (Number.isFinite(offset)) return addDays(today, Math.floor(offset));
  return tasks.some((task) => task.start <= today) && tasks.some((task) => task.end >= today)
    ? today
    : undefined;
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
  /** The header of rows without a group. */
  ungrouped: string;
  /** Visible task count on a group header ("2 tasks"). */
  groupCount: (count: number) => string;
  /** Visible text and accessible name of a group's add action. */
  add: string;
  addToGroup: (group: string) => string;
  /** Screen-reader text of a band; dates arrive formatted for the locale. */
  band: (label: string, start: string, end: string) => string;
  /** Screen-reader text of a marker ("Review window ends, March 6, 2026"). */
  marker: (label: string, when: string) => string;
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
  ungrouped: 'Ungrouped',
  groupCount: (count) => `${count} task${count === 1 ? '' : 's'}`,
  add: 'Add',
  addToGroup: (group) => `Add to ${group}`,
  band: (label, start, end) => `${label}: ${start} to ${end}`,
  marker: (label, when) => `${label}, ${when}`,
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
