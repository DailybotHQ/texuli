import type { IsoDate, MoveChoiceId, Occurrence } from '../engines/calendar/index.ts';

export type CalendarTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

export interface CalendarItem<TData = unknown> extends Occurrence<TData> {
  /** Same as `key`; lets `layoutDay` place the item. */
  id: string;
  /** Stable while the item moves (see `eventKey`). */
  key: string;
  title: string;
  tone: CalendarTone;
  /** It can be dragged or moved with Ctrl+Arrow keys. */
  movable: boolean;
  /** Picked up with Space: shown where the arrow keys have taken it. */
  grabbed?: boolean;
}

/** What `onChange` receives when an event is rescheduled. */
export interface CalendarChange<TData = unknown> {
  /** The series id: the record to update. */
  id: string;
  /** The occurrence's original start; tells repeating occurrences apart. */
  occurrenceId: string;
  /** New start and end, in the series' format (instants, or dates when all-day). */
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  /** The occurrence as it was before the move. */
  occurrence: Occurrence<TData>;
}

export interface CalendarLabels {
  calendar: string;
  previous: string;
  next: string;
  today: string;
  month: string;
  week: string;
  day: string;
  agenda: string;
  loading: string;
  empty: string;
  allDay: string;
  moreEvents: (count: number) => string;
  eventCount: (count: number) => string;
  /** Appended to every event's accessible name. */
  openHint: string;
  /** Description of a movable event. */
  moveHint: string;
  moved: (title: string, when: string) => string;
  cannotMove: (title: string) => string;
  outOfRange: (title: string) => string;
  moveFailed: (title: string) => string;
  recurring: string;
  /** Name of an event's Move menu. */
  moveMenu: (title: string) => string;
  /** One Move menu destination. */
  moveChoice: (id: MoveChoiceId, slotMinutes: number) => string;
  /** Appended to a destination that would leave the allowed dates. */
  outsideDates: string;
  grabbed: (title: string) => string;
  grabMoved: (title: string, when: string) => string;
  moveCancelled: string;
  /** Name of the focused empty time slot. */
  emptySlot: (when: string) => string;
  /** Appended to the empty slot's name when activating it creates an event. */
  addsEvent: string;
  /** Appended to a date's name when activating it creates an all-day event. */
  addsAllDayEvent: string;
}

export interface CalendarDay {
  date: IsoDate;
  items: CalendarItem[];
}

export const DEFAULT_CALENDAR_LABELS: CalendarLabels = {
  calendar: 'Calendar',
  previous: 'Previous period',
  next: 'Next period',
  today: 'Today',
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
  loading: 'Loading calendar view',
  empty: 'No events scheduled.',
  allDay: 'All day',
  moreEvents: (count) => `${count} more events`,
  eventCount: (count) => `${count} event${count === 1 ? '' : 's'}`,
  openHint: 'press Enter to open',
  moveHint:
    'Space picks this event up, arrow keys move it and Space or Enter drops it. Alt or Control plus arrow keys move it directly, Shift+F10 opens its move options, or drag it to another day or time.',
  moved: (title, when) => `${title} moved to ${when}.`,
  cannotMove: (title) => `${title} can't be moved.`,
  outOfRange: (title) => `${title} can't move outside the allowed dates.`,
  moveFailed: (title) => `${title} was not moved.`,
  recurring: 'recurring',
  moveMenu: (title) => `Move ${title} to…`,
  moveChoice: (id, slotMinutes) =>
    ({
      'earlier-slot': `${slotMinutes} minutes earlier`,
      'later-slot': `${slotMinutes} minutes later`,
      'earlier-hour': '1 hour earlier',
      'later-hour': '1 hour later',
      'previous-day': 'Previous day',
      'next-day': 'Next day',
      'previous-week': 'Previous week',
      'next-week': 'Next week',
    })[id],
  outsideDates: 'outside the allowed dates',
  grabbed: (title) =>
    `Picked up ${title}. Arrow keys move it, Space or Enter drops it, Escape cancels.`,
  grabMoved: (title, when) => `${title}: ${when}.`,
  moveCancelled: 'Move cancelled.',
  emptySlot: (when) => `Empty slot, ${when}`,
  addsEvent: 'Enter adds an event',
  addsAllDayEvent: 'Enter adds an all-day event',
};
