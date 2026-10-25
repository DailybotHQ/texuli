/** Lazy month, week, day and agenda view. The framework-free engine is at `@texuli/data/calendar`. */

export type { CalendarSeries, CalendarSlot, Occurrence } from '../engines/calendar/index.ts';
export { default as CalendarView } from './CalendarView.svelte';
export type { CalendarMode } from './model.ts';
export { type CalendarChange, type CalendarLabels, DEFAULT_CALENDAR_LABELS } from './types.ts';
